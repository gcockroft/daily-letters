# Daily Letters

An Obsidian plugin for building a daily writing habit. Set a word goal, watch the countdown in the status bar, and let every day log itself automatically.

## Features

- **Status bar countdown** — shows words remaining for the day; turns green when your goal is met
- **Automatic daily logging** — writes (and live-updates) a row in your chosen log file as you type, so the log is always current
- **Configurable table format** — customise the header, row template, and success/fail tokens to fit your vault's style
- **Works across all files** — counts words from any markdown file you edit in the vault

## How it works

The plugin tracks the net word delta across every editor change. Words added count up; the counter resets at midnight on your first keystroke of the new day. Progress is written to your log file automatically — no manual action needed.

## Settings

| Setting | Description | Default |
|---|---|---|
| Daily word goal | Words to write before the status bar turns green | `500` |
| Tracking file | Vault-relative path to the log file (created automatically) | — |
| Header format | Column headers for the markdown table | `\| Date \| Words \| Goal \| Met \|` |
| Row format | Row template — tokens: `{date}` `{words}` `{goal}` `{status}` | `\| {date} \| {words} \| {goal} \| {status} \|` |
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
