import { AbstractInputSuggest, App, normalizePath, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import type DailyLettersPlugin from './main';
import { buildRow, columnsMatch, invalidPatterns, makeSeparator } from './log';

export interface DailyLettersSettings {
	dailyGoal: number;
	trackingFile: string;
	excludePatterns: string;
	headerFormat: string;
	rowFormat: string;
	successToken: string;
	failedToken: string;
}

export const DEFAULT_SETTINGS: DailyLettersSettings = {
	dailyGoal: 500,
	trackingFile: '',
	excludePatterns: '',
	headerFormat: '| Date | Words | Goal | Met |',
	rowFormat: '| {date} | {words} | {goal} | {status} |',
	successToken: '🟢',
	failedToken: '🔴',
};

class FileSuggest extends AbstractInputSuggest<TFile> {
	private onChosen: (path: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, onChosen: (path: string) => void) {
		super(app, inputEl);
		this.onChosen = onChosen;
	}

	getSuggestions(query: string): TFile[] {
		return this.app.vault.getMarkdownFiles().filter((f) =>
			f.path.toLowerCase().includes(query.toLowerCase())
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement) {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile) {
		this.setValue(file.path);
		this.onChosen(file.path);
		this.close();
	}
}

export class DailyLettersSettingTab extends PluginSettingTab {
	plugin: DailyLettersPlugin;

	constructor(app: App, plugin: DailyLettersPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const settings = this.plugin.settings;
		const save = () => { void this.plugin.saveSettings(); };
		containerEl.empty();

		// Formats are edited as drafts and only copied into settings when valid,
		// so a half-typed format can never be saved by some other change
		let headerDraft = settings.headerFormat;
		let rowDraft = settings.rowFormat;

		// Live preview
		const preview = containerEl.createDiv({ cls: 'daily-letters-preview' });
		preview.createEl('p', { text: 'Logs your daily word count to a Markdown table:' });
		const pre = preview.createEl('pre');
		const previewCode = pre.createEl('code');

		const updatePreview = () => {
			const example = (date: string, words: number, files: string) =>
				buildRow(rowDraft, date, words, settings.dailyGoal, settings.successToken, settings.failedToken, files);
			previewCode.textContent = [
				headerDraft,
				makeSeparator(headerDraft),
				example('2026-08-01', settings.dailyGoal + 23, '[[note1]], [[note2]]'),
				example('2026-08-02', Math.floor(settings.dailyGoal / 2), '[[note3]]'),
			].join('\n');
		};
		updatePreview();

		// Goal
		new Setting(containerEl)
			.setName('Daily word goal')
			.setDesc('Words to write each day before the counter turns green.')
			.addText((text) =>
				text
					.setPlaceholder('500')
					.setValue(String(settings.dailyGoal))
					.onChange((value) => {
						const num = Number(value);
						const valid = Number.isInteger(num) && num > 0;
						text.inputEl.toggleClass('daily-letters-invalid', !valid);
						if (!valid) return;
						settings.dailyGoal = num;
						this.plugin.updateStatusBar();
						save();
						updatePreview();
					})
			);

		// Tracking file
		const saveTrackingFile = (value: string) => {
			settings.trackingFile = value.trim() ? normalizePath(value.trim()) : '';
			save();
		};

		new Setting(containerEl)
			.setName('Tracking file')
			.setDesc('Vault-relative path for the daily log. Start typing to search existing files, or enter a new path — it will be created automatically.')
			.addText((text) => {
				new FileSuggest(this.app, text.inputEl, saveTrackingFile);
				text
					.setPlaceholder('daily-letters-log.md')
					.setValue(settings.trackingFile)
					.onChange(saveTrackingFile);
			});

		// Exclude patterns
		new Setting(containerEl)
			.setName('Exclude patterns')
			.setDesc('Comma-separated regex patterns. Files whose path matches any pattern are ignored. E.g. templates/,\\.excalidraw$')
			.addText((text) =>
				text
					.setPlaceholder('templates/,daily-log')
					.setValue(settings.excludePatterns)
					.onChange((value) => {
						settings.excludePatterns = value;
						save();
						showPatternErrors();
					})
			);

		const patternErrorEl = containerEl.createEl('p', { cls: 'daily-letters-error' });
		const showPatternErrors = () => {
			const bad = invalidPatterns(settings.excludePatterns);
			patternErrorEl.setText(`Invalid pattern, ignored: ${bad.join(', ')}`);
			patternErrorEl.toggleClass('mod-visible', bad.length > 0);
		};
		showPatternErrors();

		// Format section
		new Setting(containerEl).setName('Log format').setHeading();

		// commitFormats is declared before the header field, assigned after errorEl is created
		// (safe because onChange only fires at runtime, after display() completes)
		let commitFormats: () => void;

		// Header format
		new Setting(containerEl)
			.setName('Header format')
			.setDesc('Column headers for the log table. Must have the same number of | columns as row format.')
			.addText((text) =>
				text
					.setPlaceholder('| Date | Words | Goal | Met |')
					.setValue(headerDraft)
					.onChange((value) => {
						headerDraft = value;
						updatePreview();
						commitFormats();
					})
			);

		// Error element sits between header and row fields in the DOM
		const errorEl = containerEl.createEl('p', { cls: 'daily-letters-error' });

		commitFormats = () => {
			const error = !columnsMatch(headerDraft, rowDraft)
				? 'Header and row format must have the same number of | columns.'
				: !rowDraft.includes('{date}')
					? 'Row format must include {date} so today\'s row can be found.'
					: '';
			errorEl.setText(error);
			errorEl.toggleClass('mod-visible', error !== '');
			if (error) return;
			if (settings.headerFormat === headerDraft && settings.rowFormat === rowDraft) return;
			settings.headerFormat = headerDraft;
			settings.rowFormat = rowDraft;
			save();
		};

		// Row format
		new Setting(containerEl)
			.setName('Row format')
			.setDesc('Row template. Available tokens: {date} {words} {goal} {status} {files}')
			.addText((text) =>
				text
					.setPlaceholder('| {date} | {words} | {goal} | {status} |')
					.setValue(rowDraft)
					.onChange((value) => {
						rowDraft = value;
						updatePreview();
						commitFormats();
					})
			);

		// Success token
		new Setting(containerEl)
			.setName('Success token')
			.setDesc('Replaces {status} when the daily goal is met.')
			.addText((text) =>
				text
					.setPlaceholder('🟢')
					.setValue(settings.successToken)
					.onChange((value) => {
						settings.successToken = value;
						updatePreview();
						save();
					})
			);

		// Failed token
		new Setting(containerEl)
			.setName('Failed token')
			.setDesc('Replaces {status} when the daily goal is not met.')
			.addText((text) =>
				text
					.setPlaceholder('🔴')
					.setValue(settings.failedToken)
					.onChange((value) => {
						settings.failedToken = value;
						updatePreview();
						save();
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
						if (!settings.trackingFile) {
							new Notice('Daily Letters: set a tracking file first');
							return;
						}
						this.plugin.checkDay();
						if (await this.plugin.flush()) new Notice('Daily Letters: entry written');
					})
			);

		commitFormats();
	}
}
