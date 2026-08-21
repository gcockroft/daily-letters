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

export function isExcluded(path: string, patterns: string): boolean {
	if (!patterns.trim()) return false;
	return patterns.split(',').some((p) => {
		const trimmed = p.trim();
		if (!trimmed) return false;
		try {
			return new RegExp(trimmed).test(path);
		} catch {
			return false;
		}
	});
}

export function formatNotes(paths: string[]): string {
	if (paths.length === 0) return '';
	return paths.map((p) => `[[${p.replace(/\.md$/, '')}]]`).join(', ');
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
	return rowFormat
		.replace('{date}', date)
		.replace('{words}', String(wordsToday))
		.replace('{goal}', String(goal))
		.replace('{status}', status)
		.replace('{files}', notes);
}
