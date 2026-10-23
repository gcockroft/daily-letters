# Daily Letters

An Obsidian plugin for building a daily writing habit. Set a word goal, watch the countdown in the status bar, and let every day log itself automatically.

## Features

- **Status bar countdown** — shows words remaining for the day; turns green when your goal is met
- **Automatic daily logging** — writes (and live-updates) a row in your chosen log file as you type, so the log is always current
- **Configurable table format** — customise the header, row template, and success/fail tokens to fit your vault's style
- **Works across all files** — counts words from any markdown file you edit in the vault

## How it works

The plugin counts words you add in any markdown editor. Deleting words never subtracts, so the count is the total you typed that day: retyping a deleted sentence, or cutting and pasting text, counts again. When you open a file, its first edit sets a baseline and earns nothing, so text already in the file (or synced in from another device while it was closed) is never credited.

The counter resets at midnight, and the finished day's row is written to the log. Progress is written to your log file a couple of seconds after you stop typing — no manual action needed. Edits to the log file itself and to excluded files are not counted.

## Settings

| Setting | Description | Default |
|---|---|---|
| Daily word goal | Words to write before the status bar turns green | `500` |
| Tracking file | Vault-relative path to the log file (created automatically) | — |
| Header format | Column headers for the markdown table | `\| Date \| Words \| Goal \| Met \|` |
| Exclude patterns | Comma-separated regexes; matching file paths are not counted | — |
| Row format | Row template — tokens: `{date}` `{words}` `{goal}` `{status}` `{files}`. Must include `{date}` | `\| {date} \| {words} \| {goal} \| {status} \|` |
| Success token | Replaces `{status}` when goal is met | `🟢` |
| Failed token | Replaces `{status}` when goal is not met | `🔴` |

The header and row format must have the same number of `|`-delimited columns — the settings page shows an error if they don't match.

### Log file format

The plugin writes a plain markdown table to whatever file you specify. Example with defaults:

```
| Date       | Words | Goal | Met |
| ---------- | ----- | ---- | --- |
| 2026-08-01 | 523   | 500  | 🟢  |
| 2026-08-02 | 210   | 500  | 🔴  |
```

The file is created automatically if it doesn't exist. You can open it, rename it, move it — just update the path in settings.

## Installation

### Community plugins (recommended)

Search for **Daily Letters** in Settings → Community plugins.

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](../../releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/daily-letters/`
3. Enable the plugin in Settings → Community plugins

### BRAT (beta)

Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) and add this repo URL.

## Development

```bash
git clone https://github.com/gcockroft534/daily-letters
cd daily-letters
npm install
npm run dev     # watch mode
npm test        # run unit tests
npm run build   # production build
```

Symlink or copy the build output into your vault's `.obsidian/plugins/daily-letters/` folder, then enable the plugin.
