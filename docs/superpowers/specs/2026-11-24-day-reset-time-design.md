# Day reset time — design

## Intent
Let people who write late at night set when their day starts (e.g. 12:30am or 1:30am). Writing done before that time counts toward the previous day, and that day's log row keeps the previous date.

## Goals
- A "Day starts at" setting accepting any time to the minute, default `00:00` (current behaviour, so existing users see no change).
- Status bar and log follow the shifted date with no further changes.

## Non-goals
- Several reset times, per-weekday resets, or time zones other than the system's local time.

## Anti-goals
- Changing the setting must never wipe or overwrite a day already logged.

## Constraints
- The day is the local date from `todayStr()` in `src/main.ts`. `DayTracker.rollover` starts a new day whenever that date differs from the saved one. It runs every minute and on each edit.

## Approaches
1. **Shift the clock (chosen).** Today's date = (now − reset offset) formatted `YYYY-MM-DD`. One small pure function; status bar, log and saved data keep working on plain dates.
2. Store a start timestamp per day and compare instants. More state and a data migration for no gain.
3. Schedule a timer for the reset moment. Breaks across sleep or wake and restarts; the minute poll already covers this.

## Decided
- **Setting:** `dayStartTime: string`, stored as `HH:MM` (24-hour), default `'00:00'`. Shown as a native time input (`<input type="time">`), which displays as 12-hour or 24-hour depending on the user's locale.
- **Validation:** an invalid or empty value falls back to `00:00` when the date is worked out. Saved data without the field picks up the default through the existing `Object.assign` defaults.
- **Date function:** a pure `dayFor(now, dayStartTime)` in `tracker.ts` (no Obsidian import; uses `Date`). Subtract the offset's minutes from `now` and format the local date. Unit-tested, including 00:29 vs 00:30 around a 00:30 start, midnight default, and month and year boundaries.
- **Safety:** `rollover` only starts a new day when the new date is later than the saved date (string comparison works for `YYYY-MM-DD`). Example: at 2am on the 25th, changing the start from 00:00 to 04:00 keeps tracking the 25th, which then ends at 04:00 on the 26th. Tested.
- **When the setting changes:** call `checkDay()` so the status bar and log update straight away.

## Left to the builder
- Setting description wording and where it sits in the settings tab (suggested: just under "Daily word goal").
- Whether to show "(midnight)" next to `00:00`.
