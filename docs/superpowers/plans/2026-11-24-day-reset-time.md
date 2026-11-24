# Day Reset Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Day starts at" setting (HH:MM) so writing before that time counts toward the previous day.

**Architecture:** A pure `dayFor(now, dayStartTime)` in `src/tracker.ts` replaces the plain local date in `todayStr()`. `DayTracker.rollover` only moves forward, so changing the setting can never wipe a logged day. The setting is a native time input in the settings tab.

**Tech Stack:** TypeScript, Obsidian plugin API, vitest (`npm test`), esbuild (`npm run build`), eslint (`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-11-24-day-reset-time-design.md`

## Global Constraints

- Setting key `dayStartTime: string`, 24-hour `HH:MM`, default `'00:00'`.
- Invalid or empty values behave as `00:00`.
- `src/tracker.ts` stays free of Obsidian imports.
- Work on branch `feat/day-reset-time` cut from `master`, not from `feat/files-one-per-line`.

## Review Focus

1. **DST change nights:** the reset must follow local clock time, not "now minus N×60s", so a 01:30 start still splits at 01:30 wall-clock on the night clocks change. Pinned by the algorithm in Task 1 (compare local minutes of the day, no millisecond arithmetic) and the `uses wall-clock time` test.
2. **Exact boundary minute:** 00:29 belongs to the previous day and 00:30 to the new one, given a 00:30 start. Task 1 test.
3. **Month and year boundaries:** 01:00 on Jan 1 with a 01:30 start → previous year's Dec 31. Task 1 test.
4. **Moving the start later after midnight:** must not produce an earlier date and overwrite a logged row. Task 1 `rollover` test.
5. **Junk saved values** (`''`, `'25:00'`, `'9:5'`, from a hand-edited data.json): treated as midnight, no crash. Task 1 `parseDayStart` test.

---

### Task 1: Shifted day calculation and forward-only rollover

**Files:**
- Modify: `src/tracker.ts` (add two exports; change `rollover`)
- Test: `src/tracker.test.ts`

**Interfaces:**
- Produces: `parseDayStart(value: string): number` (minutes after midnight, 0–1439; 0 for anything not matching `/^([01]\d|2[0-3]):[0-5]\d$/`).
- Produces: `dayFor(now: Date, dayStartTime: string): string` (`YYYY-MM-DD` in local time).
- Changes: `DayTracker.rollover(today: string): DayData | null` returns null unless `today > this.day.date`.

- [ ] **Step 1: Create the branch and commit the spec and plan**

```bash
git switch -c feat/day-reset-time master
git add docs/superpowers/specs/2026-11-24-day-reset-time-design.md docs/superpowers/plans/2026-11-24-day-reset-time.md
git commit -m "docs: day reset time design and plan"
```

- [ ] **Step 2: Write the failing tests** in `src/tracker.test.ts` (dates built with the local `new Date(y, m, d, h, min)` constructor)

```ts
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
	it('uses wall-clock time', () => {
		// 2026-03-29 is the EU spring-forward night; result must depend only on local h:m
		expect(dayFor(new Date(2026, 2, 29, 1, 29), '01:30')).toBe('2026-03-28');
		expect(dayFor(new Date(2026, 2, 29, 3, 0), '01:30')).toBe('2026-03-29');
	});
	it('falls back to midnight for an invalid start', () => {
		expect(dayFor(new Date(2026, 10, 25, 0, 10), 'junk')).toBe('2026-11-25');
	});
});
```

And inside the existing `describe('DayTracker')`:

```ts
it('never rolls back to an earlier date', () => {
	const t = fresh(); // 2026-10-22
	t.onEdit('a.md', 1);
	t.onEdit('a.md', 3);
	expect(t.rollover('2026-10-21')).toBeNull();
	expect(t.day).toEqual({ date: '2026-10-22', words: 2, files: ['a.md'] });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL. `parseDayStart` and `dayFor` aren't exported yet, and the rollback test fails because the date becomes `2026-10-21`.

- [ ] **Step 4: Implement in `src/tracker.ts`**

`dayFor`: if `now.getHours() * 60 + now.getMinutes() < parseDayStart(dayStartTime)`, use the previous calendar date (`new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)`). Otherwise use `now`'s date. Format as zero-padded `YYYY-MM-DD` from the local getters. No millisecond arithmetic. `rollover`: change the guard to `if (today <= this.day.date) return null;`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tracker.ts src/tracker.test.ts
git commit -m "feat: work out the day from a configurable start time"
```

### Task 2: Wire the setting into the plugin and settings tab

**Files:**
- Modify: `src/settings.ts` (interface, `DEFAULT_SETTINGS`, new Setting just under "Daily word goal")
- Modify: `src/main.ts:13` (`todayStr`)
- Modify: `README.md` (Settings table)

**Interfaces:**
- Consumes: `dayFor(now: Date, dayStartTime: string): string` from `./tracker`.
- Consumes: `DailyLettersPlugin.checkDay(): void` (existing).

- [ ] **Step 1: Add the setting** `dayStartTime: string` to `DailyLettersSettings`, default `'00:00'`.

- [ ] **Step 2: Use it for the date.** In `src/main.ts`, make `todayStr` a method or closure that returns `dayFor(new Date(), this.settings.dayStartTime)`. Update all three call sites (line 30 runs after settings load). Remove the `moment` import if it's no longer used.

- [ ] **Step 3: Add the settings UI** under "Daily word goal":
  - Name: `Day starts at`
  - Desc: `Writing before this time counts toward the previous day. Midnight by default.`
  - `addText`, then `text.inputEl.type = 'time'`, value `settings.dayStartTime`.
  - `onChange`: if `parseDayStart(value)` is 0 and `value !== '00:00'`, add the `daily-letters-invalid` class and return. Otherwise remove it, set `settings.dayStartTime = value`, then call `save()` and `this.plugin.checkDay()`.

- [ ] **Step 4: Add a README row** to the Settings table: `| Day starts at | Writing before this time counts toward the previous day (e.g. 01:30 for night owls) | 00:00 |`.

- [ ] **Step 5: Verify**

Run: `npm test && npm run build && npm run lint`
Expected: tests pass, build exits 0, lint reports no errors.

- [ ] **Step 6: Manual check in Obsidian.** Write a few words, then set the start time to one minute after the current time. This makes "today" yesterday's date. Both the status bar count and today's log row should stay the same, because the date doesn't go backwards. Reload the plugin and confirm the setting is still there. Clearing the field should show the invalid style and leave the saved value as it was. The actual reset at a non-midnight time can only be seen the next day; the tests in Task 1 cover it.

- [ ] **Step 7: Commit**

```bash
git add src/settings.ts src/main.ts README.md
git commit -m "feat: add Day starts at setting"
```
