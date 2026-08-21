import { moment, Plugin, TFile, MarkdownView } from 'obsidian';
import { DailyLettersSettings, DEFAULT_SETTINGS, DailyLettersSettingTab } from './settings';
import { countWords, countCols, makeSeparator, buildRow, isExcluded, formatNotes } from './utils';
export { countCols, makeSeparator };

interface DayData {
	date: string;       // YYYY-MM-DD
	wordsToday: number;
	editedFiles: string[];
}

interface PersistedData {
	settings: DailyLettersSettings;
	today: DayData;
}

export default class DailyLettersPlugin extends Plugin {
	settings!: DailyLettersSettings;
	today!: DayData;
	statusBarItem!: HTMLElement;

	private fileWordCounts = new Map<string, number>();
	private editedFilesSet = new Set<string>();
	private saveDebounce: number | null = null;
	private settingsDebounce: number | null = null;

	async onload() {
		const saved = await this.loadData() as PersistedData | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved?.settings);
		this.today = Object.assign({ date: '', wordsToday: 0, editedFiles: [] }, saved?.today);
		this.editedFilesSet = new Set(this.today.editedFiles);

		this.statusBarItem = this.addStatusBarItem();

		// Initialize today's date immediately so upserts always have a valid date
		this.handleDayRollover();
		this.updateStatusBar();

		this.app.workspace.iterateAllLeaves((leaf) => {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file) {
				this.fileWordCounts.set(view.file.path, countWords(view.editor.getValue()));
			}
		});

		this.registerEvent(
			this.app.workspace.on('editor-change', (editor, view) => {
				if (!(view instanceof MarkdownView) || !view.file) return;
				if (isExcluded(view.file.path, this.settings.excludePatterns)) return;

				this.handleDayRollover();

				const path = view.file.path;
				const current = countWords(editor.getValue());
				const previous = this.fileWordCounts.get(path) ?? current;
				const delta = current - previous;

				this.fileWordCounts.set(path, current);

				if (delta > 0) {
					this.today.wordsToday += delta;
					if (!this.editedFilesSet.has(path) && path !== this.settings.trackingFile) {
						this.editedFilesSet.add(path);
						this.today.editedFiles = [...this.editedFilesSet];
					}
					this.updateStatusBar();
					this.debouncedSave();
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (!leaf) return;
				const view = leaf.view;
				if (view instanceof MarkdownView && view.file) {
					if (isExcluded(view.file.path, this.settings.excludePatterns)) return;
					const path = view.file.path;
					if (!this.fileWordCounts.has(path)) {
						this.fileWordCounts.set(path, countWords(view.editor.getValue()));
					}
				}
			})
		);

		this.addSettingTab(new DailyLettersSettingTab(this.app, this));
	}

	onunload() {
		if (this.saveDebounce) window.clearTimeout(this.saveDebounce);
		if (this.settingsDebounce) window.clearTimeout(this.settingsDebounce);
	}

	debouncedPersistSettings() {
		if (this.settingsDebounce) window.clearTimeout(this.settingsDebounce);
		this.settingsDebounce = window.setTimeout(() => { void this.persist(); }, 1000);
	}

	private handleDayRollover() {
		const todayStr = moment().format('YYYY-MM-DD');
		if (this.today.date === todayStr) return;
		this.today = { date: todayStr, wordsToday: 0, editedFiles: [] };
		this.editedFilesSet.clear();
		this.updateStatusBar();
	}

	async upsertLogEntry() {
		const path = this.settings.trackingFile;
		if (!path || !this.today.date) return;

		const { date, wordsToday, editedFiles } = this.today;
		const goal = this.settings.dailyGoal;
		const notes = formatNotes(editedFiles);
		const row = buildRow(
			this.settings.rowFormat,
			date, wordsToday, goal,
			this.settings.successToken,
			this.settings.failedToken,
			notes,
		);
		const headerRow = this.settings.headerFormat;
		const separator = makeSeparator(headerRow);
		const header = `${headerRow}\n${separator}\n`;

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			let content = await this.app.vault.read(existing);

			// Ensure header exists — check for a separator row rather than the exact
			// header string, since Obsidian's table formatter may repad column widths
			const hasSeparator = content.split('\n').some(l => /^\|[-| :]+\|/.test(l));
			if (!hasSeparator) {
				content = header + (content.trim() ? content.trim() + '\n' : '');
			}

			const lines = content.split('\n');
			const idx = lines.findIndex((l) => l.startsWith(`| ${date}`));
			if (idx !== -1) {
				lines[idx] = row;
				await this.app.vault.modify(existing, lines.join('\n'));
			} else {
				const appended = content.endsWith('\n') ? content + row + '\n' : content + '\n' + row + '\n';
				await this.app.vault.modify(existing, appended);
			}
		} else {
			await this.app.vault.create(path, header + row + '\n');
		}
	}

	updateStatusBar() {
		const remaining = this.settings.dailyGoal - this.today.wordsToday;
		if (remaining <= 0) {
			this.statusBarItem.setText('✓ done');
			this.statusBarItem.addClass('daily-letters-done');
		} else {
			this.statusBarItem.setText(`${remaining} words left`);
			this.statusBarItem.removeClass('daily-letters-done');
		}
	}

	private debouncedSave() {
		if (this.saveDebounce) window.clearTimeout(this.saveDebounce);
		this.saveDebounce = window.setTimeout(() => { void this.persist(); }, 2000);
	}

	async persist() {
		await this.saveData({ settings: this.settings, today: this.today });
		await this.upsertLogEntry();
	}
}
