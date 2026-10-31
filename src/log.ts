// Pure functions — no Obsidian imports. Testable in isolation.

export function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}

export function countCols(format: string): number {
	return format.split('|').filter(s => s.trim().length > 0).length;
}

export function makeSeparator(headerFormat: string): string {
	return '|' + '---|'.repeat(countCols(headerFormat));
}

export function columnsMatch(headerFormat: string, rowFormat: string): boolean {
	return countCols(headerFormat) === countCols(rowFormat);
}

function splitPatterns(patterns: string): string[] {
	return patterns.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
}

function tryRegExp(pattern: string): RegExp | null {
	try {
		return new RegExp(pattern);
	} catch {
		return null;
	}
}

// Invalid patterns are ignored here; the settings tab reports them via invalidPatterns
export function isExcluded(path: string, patterns: string): boolean {
	return splitPatterns(patterns).some((p) => tryRegExp(p)?.test(path) ?? false);
}

export function invalidPatterns(patterns: string): string[] {
	return splitPatterns(patterns).filter((p) => tryRegExp(p) === null);
}

export function formatNotes(paths: string[]): string {
	if (paths.length === 0) return '';
	return paths
		.map((p) => p.replace(/\.md$/, '').replace(/[[\]]/g, '').replace(/\|/g, '\\|'))
		.map((p) => `[[${p}]]`)
		.join(', ');
}

export function buildRow(
	rowFormat: string,
	date: string,
	wordsToday: number,
	goal: number,
	successToken: string,
	failedToken: string,
	notes: string = '',
): string {
	const status = wordsToday >= goal ? successToken : failedToken;
	// Function replacers insert values literally — no `$&`-style patterns
	return rowFormat
		.replaceAll('{date}', () => date)
		.replaceAll('{words}', () => String(wordsToday))
		.replaceAll('{goal}', () => String(goal))
		.replaceAll('{status}', () => status)
		.replaceAll('{files}', () => notes);
}

// Cells of a table line, split on unescaped pipes and trimmed
function splitCells(line: string): string[] {
	return line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

function isSeparator(line: string | undefined): boolean {
	return line !== undefined && /^\s*\|[\s:|-]+\|\s*$/.test(line) && line.includes('-');
}

function isTableLine(line: string | undefined): boolean {
	return line !== undefined && line.trimStart().startsWith('|');
}

interface Table { header: number; end: number }   // line indexes; end is exclusive

// A header line followed by a separator starts a table. A second header +
// separator inside a table (two copies of the log merged by sync) starts a new one.
function findTables(lines: string[]): Table[] {
	const tables: Table[] = [];
	for (let i = 0; i < lines.length - 1; i++) {
		if (!isTableLine(lines[i]) || !isSeparator(lines[i + 1])) continue;
		let end = i + 2;
		while (isTableLine(lines[end]) && !isSeparator(lines[end + 1])) end++;
		tables.push({ header: i, end });
		i = end - 1;
	}
	return tables;
}

const TOKEN = /\{(date|words|goal|status|files)\}/;

// Reads the number a `{goal}` cell holds, using the row format to locate it.
function goalIn(line: string, rowFormat: string): number | undefined {
	const templates = splitCells(rowFormat);
	const col = templates.findIndex((c) => c.includes('{goal}'));
	if (col === -1) return undefined;
	let captured = false;
	const pattern = templates[col]!.split(new RegExp(`(${TOKEN.source})`)).map((part, i) => {
		if (i % 3 === 2) return '';   // inner capture of TOKEN; already handled with its whole match
		if (i % 3 === 0) return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*');
		if (part === '{goal}' && !captured) { captured = true; return '(\\d+)'; }
		return part === '{goal}' ? '\\d+' : '.*?';
	}).join('');
	const match = new RegExp(`^${pattern}$`).exec(splitCells(line)[col] ?? '');
	return match ? Number(match[1]) : undefined;
}

export interface UpsertOptions {
	headerFormat: string;
	rowFormat: string;
	date: string;
	words: number;
	goal: number;
	successToken: string;
	failedToken: string;
	notes?: string;
}

/**
 * Returns `content` with the row for `date` updated, or appended to the log table.
 *
 * The log table is the one whose header matches `headerFormat`, else the first
 * with the same column count; if there is none, a new table is appended. Other
 * tables with the same header are copies of the log (e.g. two devices created
 * it before syncing) and are merged into it, the earlier row winning per date.
 *
 * An existing row for `date` keeps its goal, so with several devices the first
 * goal logged for a day wins; the words and status are rewritten.
 */
export function upsertRow(content: string, opts: UpsertOptions): string {
	const { headerFormat, rowFormat, date, words, goal, successToken, failedToken, notes = '' } = opts;
	const render = (g: number) => buildRow(rowFormat, date, words, g, successToken, failedToken, notes);
	const lines = content.split('\n');
	const headerCells = splitCells(headerFormat);
	const headerOf = (t: Table) => splitCells(lines[t.header] ?? '');
	const tables = findTables(lines);
	const log = tables.find((t) => headerOf(t).join('|') === headerCells.join('|'))
		?? tables.find((t) => headerOf(t).length === headerCells.length);

	if (!log) {
		const block = `${headerFormat}\n${makeSeparator(headerFormat)}\n${render(goal)}\n`;
		if (!content.trim()) return block;
		return (content.endsWith('\n') ? content : content + '\n') + '\n' + block;
	}

	const dateCol = splitCells(rowFormat).findIndex((c) => c.includes('{date}'));
	const dateOf = (line: string) => (dateCol === -1 ? undefined : splitCells(line)[dateCol]);
	const body = (t: Table) => lines.slice(t.header + 2, t.end);
	const copies = tables.filter((t) => t !== log && headerOf(t).join('|') === headerOf(log).join('|'));

	const rows = body(log);
	for (const row of copies.flatMap(body)) {
		const d = dateOf(row);
		if (d === undefined || !rows.some((r) => dateOf(r) === d)) rows.push(row);
	}

	const todayCell = dateOf(render(goal));
	const today = todayCell === undefined ? -1 : rows.findIndex((r) => dateOf(r) === todayCell);
	if (today === -1) rows.push(render(goal));
	else rows[today] = render(goalIn(rows[today]!, rowFormat) ?? goal);

	// Rewrite bottom-up so earlier indexes stay valid
	for (const t of [log, ...copies].sort((a, b) => b.header - a.header)) {
		if (t === log) {
			lines.splice(t.header + 2, t.end - t.header - 2, ...rows);
			continue;
		}
		let start = t.header;
		let end = t.end;
		if (start > 0 && lines[start - 1]?.trim() === '') start--;
		else if (lines[end]?.trim() === '' && end < lines.length - 1) end++;
		lines.splice(start, end - start);
	}
	return lines.join('\n');
}
