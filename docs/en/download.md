---
title: Download
---

# Download SPlayer-Kugou

The list below fetches the latest release for the selected channel from GitHub and recommends a package for your system. Stable is selected by default. If GitHub is slow, choose a download mirror.

<DownloadPage />

## Release channels

| Channel     | Intended audience       | Releases received | Example              |
| ----------- | ----------------------- | ----------------- | -------------------- |
| **Stable**  | Everyday use            | Stable            | `1.2.0`              |
| **Beta**    | Early feature access    | Beta, then Stable | `1.3.0-beta.1`       |
| **Nightly** | Development and testing | Daily builds      | `1.3.0-nightly.1100` |

Beta is promoted from Nightly every week, and Nightly is built every day. Change the channel under **Settings → General → Release channel**. Nightly builds may be highly unstable. After moving to a more stable channel, updates resume once that channel publishes a higher version.

## Other sources

- **Previous versions:** Browse all archived builds on [GitHub Releases](https://github.com/sijin-xb/splayer-kugou/releases).
- **Development builds:** Download the latest workflow artifact from [GitHub Actions](https://github.com/sijin-xb/splayer-kugou/actions). A GitHub account is required.

## Installation notes

- **Windows:** Choose the installer for automatic updates or the single-file portable build.
- **macOS:** If macOS reports that the app is damaged or cannot verify it, see [macOS reports a damaged app](/en/troubleshooting/macos-damaged).
- **Linux:** Choose AppImage if you are unsure which package format your distribution uses. See [Ubuntu sandbox startup failure](/en/troubleshooting/ubuntu-sandbox) for launch errors.

## Linux package formats

| Format   | Distributions                                    |
| -------- | ------------------------------------------------ |
| AppImage | Distribution-independent; no installation needed |
| deb      | Debian, Ubuntu, Linux Mint                       |
| rpm      | Fedora, RHEL, openSUSE                           |
| pacman   | Manjaro                                          |
| tar.gz   | Generic archive for manual extraction            |

Artifacts are named `splayer-kugou-<version>-<arch>.<ext>`.

```bash
# AppImage
chmod +x ./splayer-kugou-*.AppImage
./splayer-kugou-*.AppImage
./splayer-kugou-*.AppImage --appimage-extract

# deb
sudo apt install ./splayer-kugou-*.deb

# rpm
sudo dnf install ./splayer-kugou-*.rpm
sudo zypper install ./splayer-kugou-*.rpm

# pacman
sudo pacman -U ./splayer-kugou-*.pacman

# Archive
tar -xzf ./splayer-kugou-*.tar.gz
cd splayer-kugou-*/
./SPlayer-Kugou
```

> [!NOTE]
> The `splayer-next` package in the Arch Linux Chinese Community Repository is the upstream project, not this fork.
