# JW Push

A bot that monitors [JW.ORG](https://www.jw.org) and broadcasts new content to one or more WhatsApp Channels, each with its own language and locale.

## Features

- 🎬 **Latest videos** — polls for new videos with thumbnail image
- 📜 **New articles** — polls the JW.ORG 'What's New?' RSS feed
- 🔔 **Alerts & announcements** — polls for breaking news alerts; edits placeholder alerts in-place when the localized version arrives
- 🔁 **Deduplication** — tracks sent items per content type across restarts so nothing is sent twice
- 🗂️ **Persistent state** — saves state per channel to `run/`
- 🌍 **Multi-channel & i18n** — run multiple channels simultaneously, each with their own language and locale

## How it works

Every 60 seconds, the bot polls JW.ORG for new videos, articles, and alerts in each configured language. Anything new is posted to the matching WhatsApp channel; the GUID (or article link) is written to `run/{channelId}.json` so the same item is never sent twice — even after a restart.

One nicety worth knowing: breaking-news alerts are sometimes published in a "universal" form before the localized version is ready. The bot sends the placeholder right away and silently edits the message in place when the translation arrives, so subscribers don't get notified twice.

## Requirements

- Node.js >= 24
- pnpm
- A WhatsApp account that owns or administers all target channels

## Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/semkeijsper/jw-push
   cd jw-push
   pnpm install
   ```

2. **Create a `config.json`** based on `config.example.json`:
   ```bash
   cp config.example.json config.json
   ```

3. **Discover your channel ID** by running the bot with `--list-channels`:
   ```bash
   pnpm build && pnpm start --list-channels
   ```
   On first launch a QR code will appear in the terminal — scan it with the WhatsApp account that owns the channel. The session is saved locally, so you won't need to scan again. The bot will then print the name and ID of every channel visible to that account, and exit.

   > This step is also triggered automatically if `config.json` has no channels configured yet.

4. **Fill in `config.json`** using the IDs from the previous step. See [Configuration](#configuration) for the meaning of each field.

5. **Run the bot**:
   ```bash
   pnpm start
   ```

   > If your channel already has many subscribers, see `--baseline` in [CLI flags](#cli-flags) before your first real run — otherwise the bot will broadcast all current JW.ORG content immediately.

## Configuration

`config.json` (git-ignored) holds all channel configuration. Use `config.example.json` as a starting point:

```json
{
  "channels": [
    {
      "id": "your_channel_id@newsletter",
      "type": "production",
      "name": "English",
      "langcode": "E",
      "locale": "en",
      "articleFeedUrl": "https://www.jw.org/en/whats-new/rss/WhatsNewWebArticles/feed.xml"
    }
  ]
}
```

### Channel fields

| Field | Description |
|---|---|
| `id` | WhatsApp channel ID in the format `{id}@newsletter`. Run `pnpm start --list-channels` to print all channel IDs for the logged-in account. |
| `type` | `"production"` or `"development"` — only `development` channels are affected by `--force`. |
| `name` | Human-readable label shown in console output. |
| `langcode` | JW.ORG internal language code (e.g. `E` for English, `O` for Dutch). |
| `locale` | Locale used in URLs and message formatting (e.g. `en`, `nl`). |
| `articleFeedUrl` | RSS feed URL for the JW.ORG 'What's New?' section in this language. To find it, open [jw.org](https://www.jw.org) in the target language, navigate to the 'What's New?' section, and click the RSS button in the top-right corner (visible on desktop only). |

Both `langcode` and `locale` can be found on [jw.org/en/languages](https://www.jw.org/en/languages) — they must match the same language. `langcode` is the short uppercase abbreviation listed under each language; `locale` is the lowercase language tag next to it.

## CLI flags

Flags work with both `pnpm start` and `pnpm dev`.

| Flag | Behavior |
|---|---|
| `--list-channels` | Prints the name and ID of every WhatsApp channel visible to this account, then exits. Triggers automatically when `config.json` has no channels configured. |
| `--baseline` | Silently marks all current JW.ORG content as already sent without broadcasting anything, then resumes polling normally. Use on a brand-new channel that already has subscribers, or after migrating to a new host. |
| `--force` | Clears in-memory state and resends all current content. Only affects `type: "development"` channels — silently ignored on production. Useful for testing message formatting. |
| `--linux` | Use `/usr/bin/chromium` instead of bundled Chromium (for Linux servers like Raspberry Pi or Ubuntu). |

## Development

```bash
pnpm dev      # run with tsx (no build step required)
pnpm build    # compile TypeScript to dist/
pnpm lint     # run ESLint on src/
```

WhatsApp session data lives in `.wwebjs_auth/` and persists between runs — delete this folder to force a new QR scan. Per-channel state lives in `run/{channelId}.json` — delete a channel's file to reset its sent-item tracking (on next start without `--baseline`, the channel will be filled with current content).

## Adding a new language

1. Add an entry to the `strings` map in `src/i18n.ts` with your locale key:
   ```typescript
   "de": {
       newVideo: "Neues Video!",
       newArticle: "Neuer Artikel!",
       moreInfo: ">> Weitere Informationen auf jw.org/de <<",
   },
   ```
2. Add a matching channel entry in `config.json` using that locale, the correct `langcode`, and the RSS feed URL for the language.
3. The bot will pick up the new locale automatically. If no entry exists for a locale, it falls back to English.

---

## Credits

Built with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

Developed with the help of [Claude](https://claude.ai).
