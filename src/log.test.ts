import { describe, it, expect } from 'vitest';
import { countCols, makeSeparator, columnsMatch, buildRow, isExcluded, formatNotes, upsertRow, invalidPatterns } from './log';
import type { UpsertOptions } from './log';

describe('countCols', () => {
	it('counts columns in a standard header', () => {
		expect(countCols('| Date | Words | Goal | Met |')).toBe(4);
	});
	it('counts columns in a row template', () => {
		expect(countCols('| {date} | {words} | {goal} | {status} |')).toBe(4);
	});
	it('handles a 2-column format', () => {
		expect(countCols('| Date | Words |')).toBe(2);
	});
	it('handles a 5-column format', () => {
		expect(countCols('| A | B | C | D | E |')).toBe(5);
	});
});

describe('makeSeparator', () => {
	it('generates correct separator for 4-column header', () => {
		expect(makeSeparator('| Date | Words | Goal | Met |')).toBe('|---|---|---|---|');
	});
	it('generates correct separator for 2-column header', () => {
		expect(makeSeparator('| Date | Words |')).toBe('|---|---|');
	});
});

describe('columnsMatch', () => {
	it('returns true when header and row have the same column count', () => {
		expect(columnsMatch(
			'| Date | Words | Goal | Met |',
			'| {date} | {words} | {goal} | {status} |',
		)).toBe(true);
	});
	it('returns false when counts differ', () => {
		expect(columnsMatch(
			'| Date | Words | Goal | Notes | Met |',
			'| {date} | {words} | {goal} | {status} |',
		)).toBe(false);
	});
});

describe('isExcluded', () => {
	it('returns false for empty patterns', () => {
		expect(isExcluded('notes/hello.md', '')).toBe(false);
	});
	it('returns false for whitespace-only patterns', () => {
		expect(isExcluded('notes/hello.md', '  , , ')).toBe(false);
	});
	it('matches a simple substring pattern', () => {
		expect(isExcluded('templates/meeting.md', 'templates/')).toBe(true);
	});
	it('does not match unrelated paths', () => {
		expect(isExcluded('notes/hello.md', 'templates/')).toBe(false);
	});
	it('supports multiple comma-separated patterns', () => {
		expect(isExcluded('daily/log.md', 'templates/,daily/')).toBe(true);
	});
	it('supports regex anchors', () => {
		expect(isExcluded('foo.excalidraw.md', '\\.excalidraw')).toBe(true);
		expect(isExcluded('notes/excalidraw-ref.md', '^excalidraw')).toBe(false);
	});
	it('silently ignores invalid regex', () => {
		expect(isExcluded('notes/hello.md', '[invalid')).toBe(false);
	});
});

describe('invalidPatterns', () => {
	it('returns nothing for valid or empty patterns', () => {
		expect(invalidPatterns('templates/, \\.excalidraw$,')).toEqual([]);
	});
	it('returns each pattern that is not a valid regex', () => {
		expect(invalidPatterns('ok/,[bad, (also')).toEqual(['[bad', '(also']);
	});
});

describe('formatNotes', () => {
	it('returns empty string for no paths', () => {
		expect(formatNotes([])).toBe('');
	});
	it('formats a single path as wiki-link without .md', () => {
		expect(formatNotes(['notes/hello.md'])).toBe('[[notes/hello]]');
	});
	it('formats multiple paths as comma-separated wiki-links', () => {
		expect(formatNotes(['a.md', 'folder/b.md'])).toBe('[[a]], [[folder/b]]');
	});
	it('leaves paths without .md extension unchanged', () => {
		expect(formatNotes(['canvas.canvas'])).toBe('[[canvas.canvas]]');
	});
	it('escapes pipes so the table cell is not split', () => {
		expect(formatNotes(['a|b.md'])).toBe('[[a\\|b]]');
	});
	it('strips brackets that would close the link early', () => {
		expect(formatNotes(['a]]b[c.md'])).toBe('[[abc]]');
	});
});

describe('buildRow', () => {
	const header = '| Date | Words | Goal | Met |';
	const rowFormat = '| {date} | {words} | {goal} | {status} |';

	it('uses success token when words meet goal', () => {
		const row = buildRow(rowFormat, '2026-08-01', 500, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | 500 | 500 | 🟢 |');
	});
	it('uses success token when words exceed goal', () => {
		const row = buildRow(rowFormat, '2026-08-01', 750, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | 750 | 500 | 🟢 |');
	});
	it('uses failed token when words are below goal', () => {
		const row = buildRow(rowFormat, '2026-08-01', 210, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | 210 | 500 | 🔴 |');
	});
	it('substitutes zero words correctly', () => {
		const row = buildRow(rowFormat, '2026-08-01', 0, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | 0 | 500 | 🔴 |');
	});
	it('works with custom tokens', () => {
		const row = buildRow(rowFormat, '2026-08-01', 500, 500, 'DONE', 'MISS');
		expect(row).toBe('| 2026-08-01 | 500 | 500 | DONE |');
	});
	it('works with a custom row format (different column order)', () => {
		const custom = '| {date} | {status} | {words}/{goal} |';
		const row = buildRow(custom, '2026-08-01', 300, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | 🔴 | 300/500 |');
	});
	it('substitutes {files} token when provided', () => {
		const withFiles = '| {date} | {words} | {goal} | {status} | {files} |';
		const row = buildRow(withFiles, '2026-08-01', 500, 500, '🟢', '🔴', '[[a]], [[b]]');
		expect(row).toBe('| 2026-08-01 | 500 | 500 | 🟢 | [[a]], [[b]] |');
	});
	it('renders empty {files} when no files edited', () => {
		const withFiles = '| {date} | {words} | {files} |';
		const row = buildRow(withFiles, '2026-08-01', 100, 500, '🟢', '🔴', '');
		expect(row).toBe('| 2026-08-01 | 100 |  |');
	});
	it('leaves row unchanged when {files} token is absent', () => {
		const row = buildRow(rowFormat, '2026-08-01', 500, 500, '🟢', '🔴', '[[a]]');
		expect(row).toBe('| 2026-08-01 | 500 | 500 | 🟢 |');
	});
	it('replaces every occurrence of a token', () => {
		const row = buildRow('| {date} | [[{date}]] |', '2026-08-01', 0, 500, '🟢', '🔴');
		expect(row).toBe('| 2026-08-01 | [[2026-08-01]] |');
	});
	it('inserts values literally, without $ replacement patterns', () => {
		const row = buildRow('| {status} | {files} |', '2026-08-01', 0, 500, '$&', '$`', "[[cost$&]], [[x$']]");
		expect(row).toBe("| $` | [[cost$&]], [[x$']] |");
	});
	it('validates row against header column count', () => {
		// Sanity: default header and row should always match
		expect(columnsMatch(header, rowFormat)).toBe(true);
	});
});


describe('upsertRow', () => {
	const headerFormat = '| Date | Words | Goal | Met |';
	const rowFormat = '| {date} | {words} | {goal} | {status} |';
	const header = '| Date | Words | Goal | Met |\n|---|---|---|---|\n';
	const opts = (date: string, added: number, overrides: Partial<UpsertOptions> = {}): UpsertOptions =>
		({ headerFormat, rowFormat, date, added, goal: 500, successToken: '🟢', failedToken: '🔴', ...overrides });

	it('creates a table in an empty file', () => {
		const out = upsertRow('', opts('2026-08-01', 5));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n');
	});
	it('adds to today\'s existing row', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe(header + '| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('updates the status once the sum reaches the goal', () => {
		const content = header + '| 2026-08-01 | 400 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 100));
		expect(out).toBe(header + '| 2026-08-01 | 500 | 500 | 🟢 |\n');
	});
	it('appends a new day after the last row', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-02', 1));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |\n');
	});
	it('is idempotent when nothing new is added', () => {
		const once = upsertRow('', opts('2026-08-01', 5));
		expect(upsertRow(once, opts('2026-08-01', 0))).toBe(once);
	});
	it('matches rows Obsidian has re-padded', () => {
		const content = '| Date       | Words | Goal | Met |\n| ---------- | ----- | ---- | --- |\n| 2026-08-01 | 5     | 500  | 🔴  |\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe('| Date       | Words | Goal | Met |\n| ---------- | ----- | ---- | --- |\n| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('finds today\'s row when the date is not the first column', () => {
		const custom = { headerFormat: '| Words | Date |', rowFormat: '| {words} | {date} |' };
		const content = '| Words | Date |\n|---|---|\n| 5 | 2026-08-01 |\n';
		const out = upsertRow(content, opts('2026-08-01', 4, custom));
		expect(out).toBe('| Words | Date |\n|---|---|\n| 9 | 2026-08-01 |\n');
	});
	it('does not mistake another date-like cell for today\'s row', () => {
		const content = header + '| 2026-08-02 | 2026 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 1));
		expect(out).toBe(content + '| 2026-08-01 | 1 | 500 | 🔴 |\n');
	});
	it('inserts at the end of the table, not the end of the file', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n\nSome notes after.\n';
		const out = upsertRow(content, opts('2026-08-02', 1));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |\n\nSome notes after.\n');
	});
	it('ignores an unrelated table and appends a new one after existing content', () => {
		const content = '---\ntags: log\n---\n| A | B |\n|---|---|\n| x | y |\n';
		const out = upsertRow(content, opts('2026-08-01', 1));
		expect(out).toBe(content + '\n' + header + '| 2026-08-01 | 1 | 500 | 🔴 |\n');
	});
	it('keeps using an existing table after the header text changes', () => {
		const content = '| Day | Count | Target | Ok |\n|---|---|---|---|\n| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe('| Day | Count | Target | Ok |\n|---|---|---|---|\n| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('handles a file without a trailing newline', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |';
		const out = upsertRow(content, opts('2026-08-02', 1));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |');
	});
	it('handles CRLF line endings', () => {
		const content = header.replaceAll('\n', '\r\n') + '| 2026-08-01 | 5 | 500 | 🔴 |\r\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe(header.replaceAll('\n', '\r\n') + '| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('treats a row with an unreadable word count as zero', () => {
		const content = header + '| 2026-08-01 | ? | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe(header + '| 2026-08-01 | 4 | 500 | 🔴 |\n');
	});
});

describe('upsertRow files', () => {
	const files = { headerFormat: '| Date | Words | Files |', rowFormat: '| {date} | {words} | {files} |' };
	const header = '| Date | Words | Files |\n|---|---|---|\n';
	const opts = (added: number, paths: string[]): UpsertOptions => ({
		...files, date: '2026-08-01', added, goal: 500, successToken: '🟢', failedToken: '🔴', files: paths,
	});

	it('writes this device\'s files to a new row', () => {
		const out = upsertRow('', opts(5, ['a.md', 'b.md']));
		expect(out).toBe(header + '| 2026-08-01 | 5 | [[a]], [[b]] |\n');
	});
	it('adds new files to the ones already listed, without duplicates', () => {
		const content = header + '| 2026-08-01 | 5 | [[a]], [[b]] |\n';
		const out = upsertRow(content, opts(3, ['b.md', 'c.md']));
		expect(out).toBe(header + '| 2026-08-01 | 8 | [[a]], [[b]], [[c]] |\n');
	});
	it('keeps escaped pipes inside listed links', () => {
		const content = header + '| 2026-08-01 | 5 | [[a\\|b]] |\n';
		const out = upsertRow(content, opts(1, ['c.md']));
		expect(out).toBe(header + '| 2026-08-01 | 6 | [[a\\|b]], [[c]] |\n');
	});
	it('keeps listed files when this device has none', () => {
		const content = header + '| 2026-08-01 | 5 | [[a]] |\n';
		const out = upsertRow(content, opts(0, []));
		expect(out).toBe(content);
	});
});

describe('upsertRow with several devices', () => {
	const headerFormat = '| Date | Words | Goal | Met |';
	const rowFormat = '| {date} | {words} | {goal} | {status} |';
	const header = '| Date | Words | Goal | Met |\n|---|---|---|---|\n';
	const opts = (date: string, added: number, overrides: Partial<UpsertOptions> = {}): UpsertOptions =>
		({ headerFormat, rowFormat, date, added, goal: 500, successToken: '🟢', failedToken: '🔴', ...overrides });

	it('adds to the row another device already created, not a new table', () => {
		const content = header + '| 2026-08-01 | 120 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 300));
		expect(out).toBe(header + '| 2026-08-01 | 420 | 500 | 🔴 |\n');
	});
	it('keeps the existing row\'s goal when this device\'s goal differs', () => {
		const content = header + '| 2026-08-01 | 120 | 1000 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 600, { goal: 500 }));
		expect(out).toBe(header + '| 2026-08-01 | 720 | 1000 | 🔴 |\n');
	});
	it('judges the status against the existing goal', () => {
		const content = header + '| 2026-08-01 | 120 | 250 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 200, { goal: 500 }));
		expect(out).toBe(header + '| 2026-08-01 | 320 | 250 | 🟢 |\n');
	});
	it('reads the existing values from a re-padded row', () => {
		const content = '| Date       | Words | Goal | Met |\n| ---------- | ----- | ---- | --- |\n| 2026-08-01 | 5     | 800  | 🔴  |\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toContain('| 2026-08-01 | 9 | 800 | 🔴 |');
	});
	it('reads the existing values from a cell shared with other tokens', () => {
		const custom = { headerFormat: '| Date | Progress |', rowFormat: '| {date} | {words}/{goal} {status} |' };
		const content = '| Date | Progress |\n|---|---|\n| 2026-08-01 | 120/1000 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 600, custom));
		expect(out).toBe('| Date | Progress |\n|---|---|\n| 2026-08-01 | 720/1000 🔴 |\n');
	});
	it('uses this device\'s goal for a new day', () => {
		const content = header + '| 2026-08-01 | 120 | 1000 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-02', 600, { goal: 500 }));
		expect(out).toBe(content + '| 2026-08-02 | 600 | 500 | 🟢 |\n');
	});
	it('uses this device\'s goal when the existing goal cell is unreadable', () => {
		const content = header + '| 2026-08-01 | 120 | ? | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 400, { goal: 500 }));
		expect(out).toBe(header + '| 2026-08-01 | 520 | 500 | 🟢 |\n');
	});
	it('merges a duplicate log table that sync appended, adding up shared days', () => {
		const content = header + '| 2026-07-31 | 700 | 500 | 🟢 |\n| 2026-08-01 | 120 | 1000 | 🔴 |\n\n'
			+ header + '| 2026-08-01 | 40 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 300));
		expect(out).toBe(header + '| 2026-07-31 | 700 | 500 | 🟢 |\n| 2026-08-01 | 460 | 1000 | 🔴 |\n');
	});
	it('merges a duplicate header that sync spliced into the table', () => {
		const content = header + '| 2026-08-01 | 120 | 1000 | 🔴 |\n' + header + '| 2026-08-01 | 40 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 0));
		expect(out).toBe(header + '| 2026-08-01 | 160 | 1000 | 🔴 |\n');
	});
	it('keeps days that only the duplicate table has', () => {
		const content = header + '| 2026-07-30 | 10 | 500 | 🔴 |\n\n' + header + '| 2026-07-31 | 20 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('2026-08-01', 30));
		expect(out).toBe(header + '| 2026-07-30 | 10 | 500 | 🔴 |\n| 2026-07-31 | 20 | 500 | 🔴 |\n| 2026-08-01 | 30 | 500 | 🔴 |\n');
	});
	it('leaves surrounding content alone when merging', () => {
		const content = 'Intro\n\n' + header + '| 2026-08-01 | 1 | 500 | 🔴 |\n\nMiddle\n\n' + header + '| 2026-07-31 | 2 | 500 | 🔴 |\n\nOutro\n';
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe('Intro\n\n' + header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-07-31 | 2 | 500 | 🔴 |\n\nMiddle\n\nOutro\n');
	});
	it('does not merge an unrelated table with the same width', () => {
		const other = '| A | B | C | D |\n|---|---|---|---|\n| 1 | 2 | 3 | 4 |\n';
		const content = header + '| 2026-08-01 | 1 | 500 | 🔴 |\n\n' + other;
		const out = upsertRow(content, opts('2026-08-01', 4));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n\n' + other);
	});
	it('sums two devices taking turns, each adding only its new words', () => {
		// A: 100 words, goal 1000 → B: 250 words, goal 500 → A: 1100 total (1000 new)
		let file = upsertRow('', opts('2026-08-01', 100, { goal: 1000 }));
		file = upsertRow(file, opts('2026-08-01', 250, { goal: 500 }));
		file = upsertRow(file, opts('2026-08-01', 1000, { goal: 1000 }));
		expect(file).toBe(header + '| 2026-08-01 | 1350 | 1000 | 🟢 |\n');
	});
});
