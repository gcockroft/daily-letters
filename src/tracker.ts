// Pure day/word-count state — no Obsidian imports. Testable in isolation.

export interface DayData {
	date: string;       // YYYY-MM-DD
	words: number;
	files: string[];    // paths that gained words today, in first-edit order
	logged: number;     // how many of `words` have been added to the log row
}

export function emptyDay(date: string): DayData {
	return { date, words: 0, files: [], logged: 0 };
}

export function countWords(text: string): number {
	const trimmed = text.trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).length;
}

export class DayTracker {
	day: DayData;

	// Last known word count per file. A file with no baseline credits nothing on
	// its next edit — that edit becomes the baseline. This is what stops a file
	// whose contents changed elsewhere (or loaded late) from being credited whole.
	private baselines = new Map<string, number>();

	constructor(day: DayData) {
		this.day = { ...day, files: [...day.files] };
	}

	/** If `today` is a new date, start an empty day and return the finished one. */
	rollover(today: string): DayData | null {
		if (this.day.date === today) return null;
		const finished = this.day;
		this.day = emptyDay(today);
		return finished;
	}

	/** Record an edit and return the words credited (never negative). */
	onEdit(path: string, words: number): number {
		const previous = this.baselines.get(path);
		this.baselines.set(path, words);
		if (previous === undefined || words <= previous) return 0;

		const added = words - previous;
		this.day.words += added;
		if (!this.day.files.includes(path)) this.day.files.push(path);
		return added;
	}

	forget(path: string) {
		this.baselines.delete(path);
	}

	rename(oldPath: string, newPath: string) {
		const baseline = this.baselines.get(oldPath);
		this.baselines.delete(oldPath);
		if (baseline !== undefined) this.baselines.set(newPath, baseline);
		this.day.files = this.day.files.map((p) => (p === oldPath ? newPath : p));
	}
}
