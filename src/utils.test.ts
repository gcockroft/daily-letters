import { describe, it, expect } from 'vitest';
import { countWords, countCols, makeSeparator, columnsMatch, buildRow } from './utils';

describe('countWords', () => {
	it('counts words in normal prose', () => {
		expect(countWords('hello world foo')).toBe(3);
	});
	it('returns 0 for empty string', () => {
		expect(countWords('')).toBe(0);
	});
	it('returns 0 for whitespace only', () => {
		expect(countWords('   ')).toBe(0);
	});
	it('handles extra whitespace between words', () => {
		expect(countWords('one  two\tthree\nfour')).toBe(4);
	});
});

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
	it('validates row against header column count', () => {
		// Sanity: default header and row should always match
		expect(columnsMatch(header, rowFormat)).toBe(true);
	});
});
