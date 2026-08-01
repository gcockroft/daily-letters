# Configurable Log Format

## Overview

Add four user-configurable settings that control how rows are written to the daily log file. Defaults reproduce the current hardcoded output exactly.

## Settings

Four new fields added to `DailyLettersSettings`:

| Field | Type | Default |
|---|---|---|
| `headerFormat` | string | `\| Date \| Words \| Goal \| Met \|` |
| `rowFormat` | string | `\| {date} \| {words} \| {goal} \| {status} \|` |
| `successToken` | string | `🟢` |
| `failedToken` | string | `🔴` |

The markdown separator row is auto-generated from the header column count and is not stored. Format: `|` + `---|` repeated once per column (e.g. 4 columns → `|---|---|---|---|`).

## Token Replacement

`upsertLogEntry` replaces the hardcoded row string with:

```typescript
const row = settings.rowFormat
  .replace('{date}', date)
  .replace('{words}', String(wordsToday))
  .replace('{goal}', String(goal))
  .replace('{status}', wordsToday >= goal ? settings.successToken : settings.failedToken);
```

Available tokens in `rowFormat`: `{date}`, `{words}`, `{goal}`, `{status}`.

## Validation

Column count is computed by splitting a format string on `|` and filtering empty/whitespace segments. Header and row format must produce the same column count.

- Validation runs on every change to either field
- An inline error message is shown between the two fields when counts don't match
- `persist()` is not called while validation fails

## Header Detection

`upsertLogEntry` currently detects a missing file header with `content.includes('| Date |')`. This changes to `content.includes(settings.headerFormat)` so detection works with any configured header.

## Settings UI

Fields appear in this order, below the existing goal and tracking file settings:

1. **Header format** — `Column headers for the log table. Must have the same number of | columns as row format.`
2. **Row format** — `Row template. Available tokens: {date} {words} {goal} {status}`
3. **Success token** — `Replaces {status} when the daily goal is met.`
4. **Failed token** — `Replaces {status} when the daily goal is not met.`

The existing hardcoded preview block updates to render the live configured header and an example row using the configured tokens and success token.

## Out of Scope

- Making the `# Daily Letters Log` title configurable
- Configuring the separator row independently
- Per-column width control
