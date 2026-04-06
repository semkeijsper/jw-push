# JW Push

A WhatsApp Channel bot that monitors [JW.ORG](https://www.jw.org) and automatically broadcasts new content to a WhatsApp Channel.

## Features

- 📺 **Latest videos** — polls for new videos
- 📖 **New articles** — polls the JW.ORG 'What's New?' RSS feed
- 🔔 **Alerts & announcements** — polls for breaking news alerts every minute; supports in-place editing when a placeholder alert is replaced by its localized version
- 🔁 **Deduplication** — tracks sent GUIDs per content type across restarts so nothing is sent twice
- 🗂️ **Persistent state** — saves state to `run/state.json`
- 🌐 **Configurable language** — defaults to English (`E`)

## Requirements

- Node.js >= 24
- pnpm
- A WhatsApp account that owns or administers the target channel

## Setup

1. **Clone and install dependencies**
   ```bash
   git clone https://github.com/semkeijsper/jw-push
   cd jw-push
   pnpm install
   ```

2. **Create a `.env` file** based on `.env.example`
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your values:
   ```env
   CHANNEL_ID=your_channel_id@newsletter
   LANGUAGE=E
   ARTICLE_FEED_URL=https://www.jw.org/en/whats-new/rss/WhatsNewWebArticles/feed.xml
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

# Skip the baseline check and immediately send all current content
pnpm start --force
```

### `--force` flag
By default, on the very first run the bot establishes a baseline of all existing content and does not send it — only content published *after* the bot starts will be broadcast. The `--force` flag bypasses this, which is useful for testing or filling a new channel.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `CHANNEL_ID` | — | WhatsApp Channel ID in the format `{id}@newsletter` |
| `LANGUAGE` | `E` | JW.ORG language code |
| `ARTICLE_FEED_URL` | RSS feed | URL of the JW.ORG 'What's New?' RSS feed |

## Project structure

```
src/
  index.ts      — WhatsApp client setup, entry point
  bot.ts        — Polling logic, deduplication, scheduling
  api.ts        — JW.ORG API and RSS feed fetching
  format.ts     — Message formatting for each content type
  state.ts      — Persistent state (sent GUIDs, alert tracking)
  config.ts     — Environment variable loading
  types.ts      — TypeScript interfaces for API responses
run/
  state.json    — Runtime state (git-ignored)
```

## Development

```bash
# Start with hot-reload (no build step required)
pnpm dev

# Send all current content immediately, skipping the baseline
pnpm dev --force

# Type-check without emitting
pnpm build

# Lint
pnpm lint
```

The dev server uses [tsx](https://github.com/privatenumber/tsx) to run TypeScript directly. WhatsApp session data is stored in `.wwebjs_auth/` and persists between runs — delete this folder to force a new QR scan.

State is stored in `run/state.json`. Delete this file to reset sent-item tracking (use `--force` on the next run to avoid flooding the channel with existing content).

---

## Credits

Built with [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js).

Developed with the help of [Claude](https://claude.ai).