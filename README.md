# JW Push

A WhatsApp Channel bot that monitors [JW.ORG](https://www.jw.org) and automatically broadcasts new content to one or more WhatsApp Channels.

## Features

- 🎬 **Latest videos** — polls for new videos with thumbnail image
- 📜 **New articles** — polls the JW.ORG 'What's New?' RSS feed
- 🔔 **Alerts & announcements** — polls for breaking news alerts; edits placeholder alerts in-place when the localized version arrives
- 🔁 **Deduplication** — tracks sent GUIDs per content type across restarts so nothing is sent twice
- 🗂️ **Persistent state** — saves state per channel to `run/`
- 🌍 **Multi-channel & i18n** — run multiple channels simultaneously, each with their own language and locale

## Requirements

- Node.js >= 24
- pnpm
- A WhatsApp account that owns or administers all target channels

## Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/semkeijsper/jw-push
   cd jw-push
   pnpm install
   ```

2. **Create a `config.json`** based on `config.example.json`
   ```bash
   cp config.example.json config.json
   ```
   Edit `config.json` with your channel details:
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

3. **Run the bot**
   ```bash
   pnpm build && pnpm start
   ```
   On first launch, a QR code will appear in the terminal. Scan it with the WhatsApp account that owns the channel. The session is saved locally and the QR code will not appear again on subsequent runs.

## Usage

```bash
# Start normally
pnpm start

# Establish a silent baseline without sending anything (useful after losing state or migrating hosts)
pnpm start --baseline

# Force-resend all current content on development channels
pnpm start --force

# Run on Linux (Raspberry Pi / Ubuntu) where Chromium is at /usr/bin/chromium
pnpm start --linux
```

### Startup modes

| Mode | How | Behavior |
|---|---|---|
| **Normal — new channel** | No state file | Polls immediately and fills the channel with all current content |
| **Normal — existing state** | State file present | Resumes from saved state, only sends new content |
| **`--baseline`** | Flag, all channels | Silently marks all current content as already sent, then polls normally. Use when migrating to a new host or after losing the state file |
| **`--force`** | Flag, `type: "development"` channels only | Clears in-memory state and resends all current content. Useful for testing message formatting |

> `--force` is silently ignored on `type: "production"` channels.

## Configuration

`config.json` (git-ignored) holds all channel configuration. Use `config.example.json` as a starting point.

### Channel fields

| Field | Description |
|---|---|
| `id` | WhatsApp Channel ID in the format `{id}@newsletter` |
| `type` | `"production"` or `"development"` |
| `name` | Human-readable label shown in console output |
| `langcode` | JW.ORG language code (e.g. `E` for English, `O` for Dutch) |
| `locale` | Locale used in URLs and message formatting (e.g. `en`, `nl`) |
| `articleFeedUrl` | URL of the JW.ORG 'What's New?' RSS feed for this language |

## Project structure

```
src/
  index.ts      — Entry point, WhatsApp client setup
  bot.ts        — Polling logic, deduplication, scheduling
  api.ts        — JW.ORG API and RSS feed fetching
  format.ts     — Message formatting per content type
  state.ts      — Persistent state (sent GUIDs, alert tracking)
  config.ts     — config.json loading
  types.ts      — TypeScript types for API responses and channel config
  i18n.ts       — Localized strings per locale
  logger.ts     — Channel-prefixed logging utility
run/
  {channelId}.json  — Per-channel runtime state (git-ignored)
```

## Development

```bash
# Start with hot-reload (no build step required)
pnpm dev

# Force-resend on development channels
pnpm dev --force

# Establish baseline without sending
pnpm dev --baseline

# Type-check without emitting
pnpm build

# Lint
pnpm lint
```

The dev server uses [tsx](https://github.com/privatenumber/tsx) to run TypeScript directly. WhatsApp session data is stored in `.wwebjs_auth/` and persists between runs — delete this folder to force a new QR scan.

Per-channel state is stored in `run/{channelId}.json`. Delete a channel's state file to reset its sent-item tracking. On next start without `--baseline`, the channel will be filled with current content.

---

## Credits

Built with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

Developed with the help of [Claude](https://claude.ai).
