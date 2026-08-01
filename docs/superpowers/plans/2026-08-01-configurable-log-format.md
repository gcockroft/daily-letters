# Configurable Log Format Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four user-configurable settings that control the markdown table format written to the daily log file.

**Architecture:** Extend `DailyLettersSettings` with four new fields, export two shared helpers (`countCols`, `makeSeparator`) from `main.ts`, update `upsertLogEntry` to use token replacement and the configured header, and update `DailyLettersSettingTab` to render the four new fields with inline column-count validation and a live preview.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild

## Global Constraints

- All files are TypeScript under `src/`
- Build command: `npm run build` (runs `tsc -noEmit` then `esbuild`)
- No test runner is configured — verification steps are manual in Obsidian
- Defaults must reproduce the current hardcoded output exactly
- Do not introduce new dependencies

---

## File Map

| File | Changes |
|---|---|
| `src/main.ts` | Export `countCols` + `makeSeparator` helpers; update `upsertLogEntry` to use token replacement and configured header/separator |
| `src/settings.ts` | Extend `DailyLettersSettings` and `DEFAULT_SETTINGS`; add 4 new fields to `display()` with validation + live preview |

---

### Task 1: Extend settings model and add shared helpers

**Files:**
- Modify: `src/settings.ts` — add 4 fields to interface and defaults
- Modify: `src/main.ts` — export `countCols` and `makeSeparator`

**Interfaces:**
- Produces: `DailyLettersSettings.headerFormat`, `rowFormat`, `successToken`, `failedToken`
- Produces: `countCols(format: string): number` (exported from `main.ts`)
- Produces: `makeSeparator(headerFormat: string): string` (exported from `main.ts`)

- [ ] **Step 1: Add four fields to `DailyLettersSettings` in `src/settings.ts`**

Replace the existing interface and defaults:

```typescript
export interface DailyLettersSettings {
	dailyGoal: number;
	trackingFile: string;
	headerFormat: string;
	rowFormat: string;
	successToken: string;
	failedToken: string;
}

export const DEFAULT_SETTINGS: DailyLettersSettings = {
	dailyGoal: 500,
	trackingFile: '',
	headerFormat: '| Date | Words | Goal | Met |',
	rowFormat: '| {date} | {words} | {goal} | {status} |',
	successToken: '🟢',
	failedToken: '🔴',
};
```

- [ ] **Step 2: Add and export `countCols` and `makeSeparator` in `src/main.ts`**

Add these two functions below the existing `countWords` function (line 18):

```typescript
export function countCols(format: string): number {
	return format.split('|').filter(s => s.trim().length > 0).length;
}

export function makeSeparator(headerFormat: string): string {
	return '|' + '---|'.repeat(countCols(headerFormat));
}
```

- [ ] **Step 3: Build and confirm no errors**

```bash
cd ~/Code/daily-letters && npm run build
```

Expected: clean output, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/settings.ts src/main.ts
git commit -m "feat: extend settings model with log format fields and add countCols/makeSeparator helpers"
```

---

### Task 2: Update `upsertLogEntry` to use token replacement

**Files:**
- Modify: `src/main.ts:101-132` — replace hardcoded row, header, and separator with configured values

**Interfaces:**
- Consumes: `this.settings.headerFormat`, `this.settings.rowFormat`, `this.settings.successToken`, `this.settings.failedToken`
- Consumes: `countCols(format: string): number`, `makeSeparator(headerFormat: string): string` (defined in same file)

- [ ] **Step 1: Replace the body of `upsertLogEntry` in `src/main.ts`**

Replace the entire `upsertLogEntry` method (currently lines 101–132) with:

```typescript
async upsertLogEntry() {
	const path = this.settings.trackingFile;
	if (!path || !this.today.date) return;

	const { date, wordsToday } = this.today;
	const goal = this.settings.dailyGoal;

	const met = wordsToday >= goal
		? this.settings.successToken
		: this.settings.failedToken;

	const row = this.settings.rowFormat
		.replace('{date}', date)
		.replace('{words}', String(wordsToday))
		.replace('{goal}', String(goal))
		.replace('{status}', met);

	const headerRow = this.settings.headerFormat;
	const separator = makeSeparator(headerRow);
	const fileHeader = `# Daily Letters Log\n\n${headerRow}\n${separator}\n`;

	const existing = this.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) {
		let content = await this.app.vault.read(existing);

		if (!content.includes(headerRow)) {
			content = fileHeader + (content.trim() ? content.trim() + '\n' : '');
		}

		const lines = content.split('\n');
		const idx = lines.findIndex((l) => l.startsWith(`| ${date}`));
		if (idx !== -1) {
			lines[idx] = row;
			await this.app.vault.modify(existing, lines.join('\n'));
		} else {
			const appended = content.endsWith('\n')
				? content + row + '\n'
				: content + '\n' + row + '\n';
			await this.app.vault.modify(existing, appended);
		}
	} else {
		await this.app.vault.create(path, fileHeader + row + '\n');
	}
}
```

- [ ] **Step 2: Build and confirm no errors**

```bash
cd ~/Code/daily-letters && npm run build
```

Expected: clean output.

- [ ] **Step 3: Manual verification in Obsidian**

  - Reload the plugin (Settings → Community plugins → toggle Daily Letters off/on)
  - Open Settings → Daily Letters → click "Write entry"
  - Open the log file and confirm the row uses the default format: `| 2026-08-01 | X | 350 | 🟢/🔴 |`
  - Confirm the header and separator are present

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: use token replacement and configured header in upsertLogEntry"
```

---

### Task 3: Add format settings to UI with validation and live preview

**Files:**
- Modify: `src/settings.ts:47-108` — add 4 new `Setting` fields, inline validation error, live preview update

**Interfaces:**
- Consumes: `countCols(format: string): number` imported from `./main`
- Consumes: `makeSeparator(headerFormat: string): string` imported from `./main`
- Consumes: `this.plugin.settings.headerFormat`, `rowFormat`, `successToken`, `failedToken`
- Consumes: `this.plugin.debouncedPersistSettings()`

- [ ] **Step 1: Update the import in `src/settings.ts` to pull in the helpers**

Replace the first two lines:

```typescript
import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import DailyLettersPlugin, { countCols, makeSeparator } from './main';
```

- [ ] **Step 2: Replace the `display()` method in `src/settings.ts`**

Replace the entire `display()` method with:

```typescript
display(): void {
	const { containerEl } = this;
	containerEl.empty();
	containerEl.createEl('h2', { text: 'Daily Letters' });

	// Live preview
	const preview = containerEl.createEl('div', { cls: 'daily-letters-preview' });
	preview.createEl('p', { text: 'Logs your daily word count to a markdown table:' });
	const pre = preview.createEl('pre');
	const previewCode = pre.createEl('code');

	const updatePreview = () => {
		const exampleRow = this.plugin.settings.rowFormat
			.replace('{date}', '2026-08-01')
			.replace('{words}', '523')
			.replace('{goal}', String(this.plugin.settings.dailyGoal))
			.replace('{status}', this.plugin.settings.successToken);
		const sep = makeSeparator(this.plugin.settings.headerFormat);
		previewCode.textContent =
			this.plugin.settings.headerFormat + '\n' +
			sep + '\n' +
			exampleRow;
	};
	updatePreview();

	// Goal
	new Setting(containerEl)
		.setName('Daily word goal')
		.setDesc('Words to write each day before the counter turns green.')
		.addText((text) =>
			text
				.setPlaceholder('500')
				.setValue(String(this.plugin.settings.dailyGoal))
				.onChange((value) => {
					const num = parseInt(value, 10);
					if (!isNaN(num) && num > 0) {
						this.plugin.settings.dailyGoal = num;
						this.plugin.updateStatusBar();
						this.plugin.debouncedPersistSettings();
						updatePreview();
					}
				})
		);

	// Tracking file
	const saveTrackingFile = (value: string) => {
		this.plugin.settings.trackingFile = value;
		this.plugin.debouncedPersistSettings();
	};

	new Setting(containerEl)
		.setName('Tracking file')
		.setDesc('Vault-relative path for the daily log. Start typing to search existing files, or enter a new path — it will be created automatically.')
		.addText((text) => {
			new FileSuggest(this.app, text.inputEl, saveTrackingFile);
			text
				.setPlaceholder('daily-letters-log.md')
				.setValue(this.plugin.settings.trackingFile)
				.onChange(saveTrackingFile);
		});

	// Format section heading
	containerEl.createEl('h3', { text: 'Log format' });

	// validate() is declared here so it can be referenced in the header onChange,
	// but assigned after errorEl is created (onChange only fires at runtime, not at display() time)
	let validate: () => boolean;

	// Header format
	new Setting(containerEl)
		.setName('Header format')
		.setDesc('Column headers for the log table. Must have the same number of | columns as row format.')
		.addText((text) =>
			text
				.setPlaceholder('| Date | Words | Goal | Met |')
				.setValue(this.plugin.settings.headerFormat)
				.onChange((value) => {
					this.plugin.settings.headerFormat = value;
					updatePreview();
					if (validate()) this.plugin.debouncedPersistSettings();
				})
		);

	// Validation error element — sits between header and row fields in the DOM
	const errorEl = containerEl.createEl('p', {
		text: 'Header and row format must have the same number of | columns.',
		cls: 'daily-letters-error',
	});
	errorEl.style.color = 'var(--color-red)';
	errorEl.style.display = 'none';

	validate = (): boolean => {
		const valid = countCols(this.plugin.settings.headerFormat) ===
			countCols(this.plugin.settings.rowFormat);
		errorEl.style.display = valid ? 'none' : 'block';
		return valid;
	};

	// Row format
	new Setting(containerEl)
		.setName('Row format')
		.setDesc('Row template. Available tokens: {date} {words} {goal} {status}')
		.addText((text) =>
			text
				.setPlaceholder('| {date} | {words} | {goal} | {status} |')
				.setValue(this.plugin.settings.rowFormat)
				.onChange((value) => {
					this.plugin.settings.rowFormat = value;
					updatePreview();
					if (validate()) this.plugin.debouncedPersistSettings();
				})
		);

	// Success token
	new Setting(containerEl)
		.setName('Success token')
		.setDesc('Replaces {status} when the daily goal is met.')
		.addText((text) =>
			text
				.setPlaceholder('🟢')
				.setValue(this.plugin.settings.successToken)
				.onChange((value) => {
					this.plugin.settings.successToken = value;
					updatePreview();
					this.plugin.debouncedPersistSettings();
				})
		);

	// Failed token
	new Setting(containerEl)
		.setName('Failed token')
		.setDesc('Replaces {status} when the daily goal is not met.')
		.addText((text) =>
			text
				.setPlaceholder('🔴')
				.setValue(this.plugin.settings.failedToken)
				.onChange((value) => {
					this.plugin.settings.failedToken = value;
					this.plugin.debouncedPersistSettings();
				})
		);

	// Write entry button
	new Setting(containerEl)
		.setName('Write today\'s entry now')
		.setDesc('Immediately writes (or updates) today\'s row in the log file. Useful for testing.')
		.addButton((btn) =>
			btn
				.setButtonText('Write entry')
				.onClick(async () => {
					await this.plugin.upsertLogEntry();
					new Notice('Daily Letters: entry written');
				})
		);
}
```

- [ ] **Step 3: Build and confirm no errors**

```bash
cd ~/Code/daily-letters && npm run build
```

Expected: clean output.

- [ ] **Step 4: Manual verification in Obsidian**

  - Reload the plugin
  - Open Settings → Daily Letters
  - Confirm the preview renders the configured header + example row
  - Change the header format to add a column (e.g. `| Date | Words | Goal | Notes | Met |`) — confirm red error appears on the row format field
  - Fix the row format to match (e.g. `| {date} | {words} | {goal} | - | {status} |`) — confirm error disappears and settings save
  - Click "Write entry" and confirm the log file uses the new format
  - Revert both fields to defaults and confirm the original format is restored

- [ ] **Step 5: Commit**

```bash
git add src/settings.ts
git commit -m "feat: add header/row/token format settings with validation and live preview"
```
