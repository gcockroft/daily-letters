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

function findTables(lines: string[]): Table[] {
	const tables: Table[] = [];
	for (let i = 0; i < lines.length - 1; i++) {
		if (!isTableLine(lines[i]) || !isSeparator(lines[i + 1])) continue;
		let end = i + 2;
		while (isTableLine(lines[end])) end++;
		tables.push({ header: i, end });
		i = end - 1;
	}
	return tables;
}

export interface UpsertOptions {
	headerFormat: string;
	rowFormat: string;
	row: string;        // today's rendered row
}

/**
 * Returns `content` with today's row replaced, or appended to the log table.
 * The log table is the one whose header matches `headerFormat`, else the first
 * with the same column count; if there is none, a new table is appended.
 * Today's row is the one whose `{date}` cell matches the rendered row's.
 */
export function upsertRow(content: string, { headerFormat, rowFormat, row }: UpsertOptions): string {
	const lines = content.split('\n');
	const headerCells = splitCells(headerFormat);
	const tables = findTables(lines);
	const sameHeader = (t: Table) => splitCells(lines[t.header] ?? '').join('|') === headerCells.join('|');
	const sameWidth = (t: Table) => splitCells(lines[t.header] ?? '').length === headerCells.length;
	const table = tables.find(sameHeader) ?? tables.find(sameWidth);

	if (!table) {
		const block = `${headerFormat}\n${makeSeparator(headerFormat)}\n${row}\n`;
		if (!content.trim()) return block;
		return (content.endsWith('\n') ? content : content + '\n') + '\n' + block;
	}

	const dateCol = splitCells(rowFormat).findIndex((c) => c.includes('{date}'));
	const dateCell = dateCol === -1 ? undefined : splitCells(row)[dateCol];
	for (let i = table.header + 2; i < table.end; i++) {
		if (dateCell !== undefined && splitCells(lines[i] ?? '')[dateCol] === dateCell) {
			lines[i] = row;
			return lines.join('\n');
		}
	}
	lines.splice(table.end, 0, row);
	return lines.join('\n');
}
