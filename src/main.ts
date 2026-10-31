import { moment, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import { DailyLettersSettings, DEFAULT_SETTINGS, DailyLettersSettingTab } from './settings';
import { formatNotes, isExcluded, upsertRow } from './log';
import { countWords, DayData, DayTracker, emptyDay } from './tracker';

interface PersistedData {
	settings: DailyLettersSettings;
	day: DayData;
	// Pre-1.1 shape, read once for migration
	today?: { date: string; wordsToday?: number; editedFiles?: string[] };
}

const todayStr = () => moment().format('YYYY-MM-DD');

export default class DailyLettersPlugin extends Plugin {
	settings!: DailyLettersSettings;
	tracker!: DayTracker;
	statusBarItem!: HTMLElement;

	private flushTimer: number | null = null;
	private writeQueue: Promise<unknown> = Promise.resolve();

	async onload() {
		const saved = await this.loadData() as Partial<PersistedData> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved?.settings);
		if (this.settings.trackingFile) this.settings.trackingFile = normalizePath(this.settings.trackingFile);
		const legacy = saved?.today;
		const day = saved?.day
			?? (legacy && { date: legacy.date, words: legacy.wordsToday ?? 0, files: legacy.editedFiles })
			?? emptyDay(todayStr());
		// Older saves may lack files entirely
		this.tracker = new DayTracker({ ...day, files: day.files ?? [] });

		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar();
		this.addSettingTab(new DailyLettersSettingTab(this.app, this));

		// The vault index isn't ready until layout-ready, so the log can't be written before then
		this.app.workspace.onLayoutReady(() => {
			this.checkDay();
			this.registerInterval(window.setInterval(() => this.checkDay(), 60_000));

			this.registerEvent(this.app.workspace.on('editor-change', (editor, info) => {
				const path = info.file?.path;
				if (!path || path === this.settings.trackingFile) return;
				if (isExcluded(path, this.settings.excludePatterns)) return;

				this.checkDay();
				if (this.tracker.onEdit(path, countWords(editor.getValue())) > 0) {
					this.updateStatusBar();
					this.scheduleFlush();
				}
			}));

			// Contents may have changed since we last saw this file; re-baseline on its next edit
			this.registerEvent(this.app.workspace.on('file-open', (file) => {
				if (file) this.tracker.forget(file.path);
			}));
			this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
				this.tracker.rename(oldPath, file.path);
			}));
			this.registerEvent(this.app.vault.on('delete', (file) => {
				this.tracker.forget(file.path);
			}));
		});
	}

	onunload() {
		if (this.flushTimer !== null) {
			window.clearTimeout(this.flushTimer);
			void this.flush();
		}
	}

	/** Start a new day if the date has changed, writing out the finished one. */
	checkDay() {
		const finished = this.tracker.rollover(todayStr());
		if (!finished) return;
		this.updateStatusBar();
		void this.flush(finished);
	}

	updateStatusBar() {
		const remaining = this.settings.dailyGoal - this.tracker.day.words;
		if (remaining <= 0) {
			this.statusBarItem.setText('✓ done');
			this.statusBarItem.addClass('daily-letters-done');
		} else {
			this.statusBarItem.setText(`${remaining} words left`);
			this.statusBarItem.removeClass('daily-letters-done');
		}
	}

	async saveSettings() {
		await this.saveData({ settings: this.settings, day: this.tracker.day });
	}

	private scheduleFlush() {
		if (this.flushTimer !== null) window.clearTimeout(this.flushTimer);
		this.flushTimer = window.setTimeout(() => {
			this.flushTimer = null;
			void this.flush();
		}, 2000);
	}

	/**
	 * Save state and write `day`'s row to the log. Writes are queued so two
	 * flushes never read-modify-write the log at the same time.
	 * Resolves false (after showing a notice) if the write failed.
	 */
	flush(day: DayData = this.tracker.day): Promise<boolean> {
		const run = this.writeQueue.then(async () => {
			await this.saveSettings();
			await this.writeRow(day);
		});
		this.writeQueue = run.catch(() => undefined);
		return run.then(() => true, (err: unknown) => {
			console.error('Daily Letters: failed to update log', err);
			new Notice(`Daily Letters: couldn't update the log (${err instanceof Error ? err.message : String(err)})`);
			return false;
		});
	}

	private async writeRow(day: DayData) {
		const path = this.settings.trackingFile;
		if (!path) return;
		const { headerFormat, rowFormat, dailyGoal, successToken, failedToken } = this.settings;
		const update = (content: string) => upsertRow(content, {
			headerFormat, rowFormat, successToken, failedToken,
			date: day.date, words: day.words, goal: dailyGoal, notes: formatNotes(day.files),
		});

		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.process(existing, update);
			return;
		}
		const folder = path.split('/').slice(0, -1).join('/');
		if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}
		await this.app.vault.create(path, update(''));
	}
}
