import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting, TFile } from 'obsidian';
import DailyLettersPlugin, { countCols, makeSeparator } from './main';

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
		containerEl.empty();

		// Live preview
		const preview = containerEl.createDiv({ cls: 'daily-letters-preview' });
		preview.createEl('p', { text: 'Logs your daily word count to a Markdown table:' });
		const pre = preview.createEl('pre');
		const previewCode = pre.createEl('code');

		const updatePreview = () => {
			const exampleRow = this.plugin.settings.rowFormat
				.replace('{date}', '2026-08-01')
				.replace('{words}', '523')
				.replace('{goal}', String(this.plugin.settings.dailyGoal))
				.replace('{status}', this.plugin.settings.successToken)
				.replace('{files}', '[[note1]], [[note2]]');
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

		// Exclude patterns
		new Setting(containerEl)
			.setName('Exclude patterns')
			.setDesc('Comma-separated regex patterns. Files whose path matches any pattern are ignored. E.g. templates/,\\.excalidraw$')
			.addText((text) =>
				text
					.setPlaceholder('templates/,daily-log')
					.setValue(this.plugin.settings.excludePatterns)
					.onChange((value) => {
						this.plugin.settings.excludePatterns = value;
						this.plugin.debouncedPersistSettings();
					})
			);

		// Format section
		new Setting(containerEl).setName('Log format').setHeading();

		// validate declared before header field, assigned after errorEl is created
		// (safe because onChange only fires at runtime, after display() completes)
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

		// Error element sits between header and row fields in the DOM
		const errorEl = containerEl.createEl('p', {
			text: 'Header and row format must have the same number of | columns.',
			cls: 'daily-letters-error',
		});

		validate = (): boolean => {
			const valid = countCols(this.plugin.settings.headerFormat) ===
				countCols(this.plugin.settings.rowFormat);
			errorEl.toggleClass('mod-visible', !valid);
			return valid;
		};

		// Row format
		new Setting(containerEl)
			.setName('Row format')
			.setDesc('Row template. Available tokens: {date} {words} {goal} {status} {files}')
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
}
