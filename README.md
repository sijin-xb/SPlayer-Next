<div align="center">

<img alt="SPlayer-Kugou" width="120" height="120" src="public/icons/favicon.png" />

<h2>SPlayer-Kugou</h2>

<p>A desktop music player fork of SPlayer-Next with KuGou Music support.</p>

[![License](https://img.shields.io/github/license/sijin-xb/splayer-kugou)](https://github.com/sijin-xb/splayer-kugou/blob/dev/LICENSE)

**English** | [简体中文](./README.zh-CN.md)

</div>

---

## What this is

SPlayer-Kugou is a downstream fork of [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next). It keeps local playback, lyrics, and media-server support, and adds KuGou Music accounts, catalog, and cloud drive.

The differences from upstream live in `electron/main/apis/kugou/`, `src/apis/*/kugou.ts`, and the platform dispatch layer. The rest tracks upstream `dev`.

## Download

Builds are published on [Releases](https://github.com/sijin-xb/splayer-kugou/releases):

| Platform | Formats                                          |
| -------- | ------------------------------------------------ |
| Windows  | Installer with auto-update, single-file portable |
| macOS    | dmg                                              |
| Linux    | AppImage, deb, rpm, pacman, tar.gz               |

Linux artifacts are named `splayer-kugou-<version>-<arch>.<ext>`; the executable is `SPlayer-Kugou`.

> The updater and download page point at `sijin-xb/splayer-kugou`. Rename the GitHub repository and publish a release first, or update checks will fail.

## KuGou support

Sign in at **Settings → Other → Platform Login**, or switch to KG in the login dialog.

| Capability                                              | Status                    |
| ------------------------------------------------------- | ------------------------- |
| QR login and cookie login, standard and concept builds  | Available                 |
| Search for songs, albums, artists, playlists            | Available                 |
| Track URL resolution with automatic quality fallback    | Available                 |
| Daily recommendations and recommended playlists         | Available                 |
| User playlists and likes (add/remove)                   | Available                 |
| Follow and unfollow artists                             | Available                 |
| Play history and scrobble upload                        | Available, upload off     |
| Cloud drive list, upload, instant match, delete, stream | Available                 |
| Song comments                                           | Available, hot only       |
| Playlist and album collection                           | Not wired, buttons hidden |

Switch login builds at **Settings → Other → Platform Config**. Standard and concept credentials are not interchangeable; switching requires a new QR scan.

## Known limitations

- Playlist and album collection endpoints are not wired, so the buttons stay hidden for KuGou.
- Home recommendations fetch playlists only; radar, artists, and new albums stay empty.
- The `high` quality tier and the full instant-match upload path are unverified with a real account.
- KuGou comments expose the hot category only.
- Artist charts, new releases, MV, radio, KTV, and live rooms are not implemented.

## Build from source

Requires Node.js >= 24, pnpm >= 12, and a Rust toolchain.

```bash
pnpm install
pnpm dev          # Dev mode; builds native modules in debug first
pnpm build        # Full build: clean → native → typecheck → electron-vite
pnpm build:linux  # Package; build:win and build:mac also exist
```

Set `SKIP_NATIVE_BUILD=true` to skip Rust when working on the frontend only.

Native modules live in `native/`, 7 crates in total: `audio-engine`, `audio-capture`, `media-ctrl`, `taskbar-lyric`, `taskbar-thumbnail`, `opencc`, `automix-worker`.

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:native`.

## License

Licensed under [AGPL-3.0](LICENSE), inherited from upstream. Original authorship and copyright belong to [SPlayer-Next](https://github.com/SPlayer-Dev/SPlayer-Next).

Modifications and redistribution must also ship complete source under AGPL-3.0 and retain the original copyright notice.
