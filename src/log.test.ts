import { describe, it, expect } from 'vitest';
import { countCols, makeSeparator, columnsMatch, buildRow, isExcluded, formatNotes, upsertRow, invalidPatterns } from './log';

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
	const opts = (row: string, overrides = {}) =>
		({ headerFormat, rowFormat, row, ...overrides });

	it('creates a table in an empty file', () => {
		const out = upsertRow('', opts('| 2026-08-01 | 5 | 500 | 🔴 |'));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n');
	});
	it('replaces today\'s existing row', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | 9 | 500 | 🔴 |'));
		expect(out).toBe(header + '| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('appends a new day after the last row', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('| 2026-08-02 | 1 | 500 | 🔴 |'));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |\n');
	});
	it('is idempotent', () => {
		const row = '| 2026-08-01 | 5 | 500 | 🔴 |';
		const once = upsertRow('', opts(row));
		expect(upsertRow(once, opts(row))).toBe(once);
	});
	it('matches rows Obsidian has re-padded', () => {
		const content = '| Date       | Words | Goal | Met |\n| ---------- | ----- | ---- | --- |\n| 2026-08-01 | 5     | 500  | 🔴  |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | 9 | 500 | 🔴 |'));
		expect(out).toBe('| Date       | Words | Goal | Met |\n| ---------- | ----- | ---- | --- |\n| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('finds today\'s row when the date is not the first column', () => {
		const custom = { headerFormat: '| Words | Date |', rowFormat: '| {words} | {date} |' };
		const content = '| Words | Date |\n|---|---|\n| 5 | 2026-08-01 |\n';
		const out = upsertRow(content, opts('| 9 | 2026-08-01 |', custom));
		expect(out).toBe('| Words | Date |\n|---|---|\n| 9 | 2026-08-01 |\n');
	});
	it('does not mistake another date-like cell for today\'s row', () => {
		const content = header + '| 2026-08-02 | 2026 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | 1 | 500 | 🔴 |'));
		expect(out).toBe(content + '| 2026-08-01 | 1 | 500 | 🔴 |\n');
	});
	it('inserts at the end of the table, not the end of the file', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |\n\nSome notes after.\n';
		const out = upsertRow(content, opts('| 2026-08-02 | 1 | 500 | 🔴 |'));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |\n\nSome notes after.\n');
	});
	it('ignores an unrelated table and appends a new one after existing content', () => {
		const content = '---\ntags: log\n---\n| A | B |\n|---|---|\n| x | y |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | 1 | 500 | 🔴 |'));
		expect(out).toBe(content + '\n' + header + '| 2026-08-01 | 1 | 500 | 🔴 |\n');
	});
	it('keeps using an existing table after the header text changes', () => {
		const content = '| Day | Count | Target | Ok |\n|---|---|---|---|\n| 2026-08-01 | 5 | 500 | 🔴 |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | 9 | 500 | 🔴 |'));
		expect(out).toBe('| Day | Count | Target | Ok |\n|---|---|---|---|\n| 2026-08-01 | 9 | 500 | 🔴 |\n');
	});
	it('handles a file without a trailing newline', () => {
		const content = header + '| 2026-08-01 | 5 | 500 | 🔴 |';
		const out = upsertRow(content, opts('| 2026-08-02 | 1 | 500 | 🔴 |'));
		expect(out).toBe(header + '| 2026-08-01 | 5 | 500 | 🔴 |\n| 2026-08-02 | 1 | 500 | 🔴 |');
	});
	it('handles escaped pipes in a files cell', () => {
		const files = { headerFormat: '| Date | Files |', rowFormat: '| {date} | {files} |' };
		const content = '| Date | Files |\n|---|---|\n| 2026-08-01 | [[a\\|b]] |\n';
		const out = upsertRow(content, opts('| 2026-08-01 | [[c]] |', files));
		expect(out).toBe('| Date | Files |\n|---|---|\n| 2026-08-01 | [[c]] |\n');
	});
});
