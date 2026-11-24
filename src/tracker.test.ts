import { describe, it, expect } from 'vitest';
import { countWords, dayFor, DayTracker, emptyDay, parseDayStart } from './tracker';

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

describe('DayTracker', () => {
	const fresh = () => new DayTracker(emptyDay('2026-10-22'));

	it('starts from the given day', () => {
		const t = new DayTracker({ date: '2026-10-22', words: 40, files: ['a.md'], logged: 30 });
		expect(t.day).toEqual({ date: '2026-10-22', words: 40, files: ['a.md'], logged: 30 });
	});
	it('does not share the files array with the saved day', () => {
		const saved = { date: '2026-10-22', words: 0, files: [], logged: 0 };
		const t = new DayTracker(saved);
		t.onEdit('a.md', 1);
		t.onEdit('a.md', 2);
		expect(saved.files).toEqual([]);
	});

	it('credits nothing on the first edit of a file and uses it as the baseline', () => {
		const t = fresh();
		expect(t.onEdit('a.md', 3000)).toBe(0);
		expect(t.day.words).toBe(0);
	});
	it('credits words added since the previous edit', () => {
		const t = fresh();
		t.onEdit('a.md', 100);
		expect(t.onEdit('a.md', 105)).toBe(5);
		expect(t.day.words).toBe(5);
	});
	it('never credits deletions', () => {
		const t = fresh();
		t.onEdit('a.md', 100);
		expect(t.onEdit('a.md', 90)).toBe(0);
		expect(t.onEdit('a.md', 92)).toBe(2);
		expect(t.day.words).toBe(2);
	});
	it('re-baselines after forget so stale counts are not credited', () => {
		const t = fresh();
		t.onEdit('a.md', 0); // baseline taken before the file loaded
		t.forget('a.md');
		expect(t.onEdit('a.md', 3000)).toBe(0);
		expect(t.onEdit('a.md', 3001)).toBe(1);
	});
	it('tracks files independently', () => {
		const t = fresh();
		t.onEdit('a.md', 10);
		t.onEdit('b.md', 50);
		expect(t.onEdit('a.md', 12)).toBe(2);
		expect(t.onEdit('b.md', 51)).toBe(1);
		expect(t.day.words).toBe(3);
	});

	it('records a file once, only when it gains words', () => {
		const t = fresh();
		t.onEdit('a.md', 10);
		expect(t.day.files).toEqual([]);
		t.onEdit('a.md', 11);
		t.onEdit('a.md', 12);
		expect(t.day.files).toEqual(['a.md']);
	});

	it('carries the baseline and file entry across a rename', () => {
		const t = fresh();
		t.onEdit('a.md', 10);
		t.onEdit('a.md', 11);
		t.rename('a.md', 'b.md');
		expect(t.day.files).toEqual(['b.md']);
		expect(t.onEdit('b.md', 13)).toBe(2);
		expect(t.onEdit('a.md', 500)).toBe(0); // new file at the old path starts fresh
	});

	it('does nothing on rollover for the same date', () => {
		const t = fresh();
		t.onEdit('a.md', 1);
		t.onEdit('a.md', 2);
		expect(t.rollover('2026-10-22')).toBeNull();
		expect(t.day.words).toBe(1);
	});
	it('returns the finished day on rollover and starts a new empty one', () => {
		const t = fresh();
		t.onEdit('a.md', 1);
		t.onEdit('a.md', 5);
		const old = t.rollover('2026-10-23');
		expect(old).toEqual({ date: '2026-10-22', words: 4, files: ['a.md'], logged: 0 });
		expect(t.day).toEqual({ date: '2026-10-23', words: 0, files: [], logged: 0 });
	});
	it('never rolls back to an earlier date', () => {
		const t = fresh(); // 2026-10-22
		t.onEdit('a.md', 1);
		t.onEdit('a.md', 3);
		expect(t.rollover('2026-10-21')).toBeNull();
		expect(t.day).toEqual({ date: '2026-10-22', words: 2, files: ['a.md'] });
	});
	it('moves to an earlier date more than a day back (clock was wrong)', () => {
		const t = new DayTracker(emptyDay('2036-01-01'));
		expect(t.rollover('2026-10-22')?.date).toBe('2036-01-01');
		expect(t.day.date).toBe('2026-10-22');
	});
	it('ignores going back exactly one day across a month boundary', () => {
		const t = new DayTracker(emptyDay('2026-11-01'));
		expect(t.rollover('2026-10-31')).toBeNull();
	});
	it('keeps baselines across rollover so open files are not re-credited', () => {
		const t = fresh();
		t.onEdit('a.md', 100);
		t.rollover('2026-10-23');
		expect(t.onEdit('a.md', 101)).toBe(1);
	});
});

describe('parseDayStart', () => {
	it('parses HH:MM to minutes', () => {
		expect(parseDayStart('00:00')).toBe(0);
		expect(parseDayStart('00:30')).toBe(30);
		expect(parseDayStart('13:30')).toBe(810);
		expect(parseDayStart('23:59')).toBe(1439);
	});
	it('treats invalid values as midnight', () => {
		for (const v of ['', '25:00', '9:5', '12:60', 'abc', '1:30']) expect(parseDayStart(v)).toBe(0);
	});
});

describe('dayFor', () => {
	it('is the plain local date with a midnight start', () => {
		expect(dayFor(new Date(2026, 10, 25, 0, 0), '00:00')).toBe('2026-11-25');
		expect(dayFor(new Date(2026, 10, 24, 23, 59), '00:00')).toBe('2026-11-24');
	});
	it('counts time before the start toward the previous day', () => {
		expect(dayFor(new Date(2026, 10, 25, 0, 29), '00:30')).toBe('2026-11-24');
		expect(dayFor(new Date(2026, 10, 25, 0, 30), '00:30')).toBe('2026-11-25');
	});
	it('crosses month and year boundaries', () => {
		expect(dayFor(new Date(2026, 11, 1, 1, 0), '01:30')).toBe('2026-11-30');
		expect(dayFor(new Date(2027, 0, 1, 1, 0), '01:30')).toBe('2026-12-31');
	});
	// Tests run with TZ=Europe/Berlin (vitest.config.ts): clocks jump 02:00→03:00
	// on 2026-03-29 and fall back 03:00→02:00 on 2026-10-25.
	it('splits at wall-clock time on the spring-forward night', () => {
		expect(dayFor(new Date(2026, 2, 29, 1, 59), '02:30')).toBe('2026-03-28');
		expect(dayFor(new Date(2026, 2, 29, 3, 0), '02:30')).toBe('2026-03-29');
	});
	it('splits at wall-clock time on the fall-back night', () => {
		const firstPass = new Date(2026, 9, 25, 2, 29);
		const secondPass = new Date(firstPass.getTime() + 60 * 60 * 1000); // 02:29 again
		expect(secondPass.getHours()).toBe(2);
		expect(dayFor(firstPass, '02:30')).toBe('2026-10-24');
		expect(dayFor(secondPass, '02:30')).toBe('2026-10-24');
		expect(dayFor(new Date(2026, 9, 25, 2, 30), '02:30')).toBe('2026-10-25');
	});
	it('falls back to midnight for an invalid start', () => {
		expect(dayFor(new Date(2026, 10, 25, 0, 10), 'junk')).toBe('2026-11-25');
	});
});
