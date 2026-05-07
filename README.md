# Photo EXIF Util

> Chrome extension to view, analyze, and strip EXIF metadata from photos.
> **Fully client-side** — no data ever leaves your device.

## Features

- 📷 Inspect EXIF metadata of JPEG / PNG / WebP images instantly
- 🗺️ **Visualize privacy risks** (GPS coordinates, camera serial numbers, etc.)
- 🧹 Strip metadata by category and download a clean image
- 📐 Optimize images for **11 SNS profiles** (X, Instagram, LINE, Bluesky, …)
- 🌗 Light / Dark / system-preference theme
- 🇯🇵 🇺🇸 i18n: Japanese / English

## Install

### Chrome Web Store

> Pending publication.

### Developer build (manual install)

1. Download `chrome-extension.zip` from the [Releases page](https://github.com/mkontani/photo-exif-util/releases) and unzip it
2. Open `chrome://extensions/` and enable **Developer mode**
3. Click **Load unpacked** and select the unzipped folder

## Usage

1. Open the side panel via:
   - The toolbar icon → **Open side panel**, or
   - Right-click an image → **Open with Photo EXIF Util**, or
   - Keyboard shortcut `Ctrl+Shift+E` (macOS: `⌘+Shift+E`)
2. Provide an image by drag-and-drop, file picker, or URL
3. Use the **Inspect / Strip / Optimize** tabs to operate

## Privacy

This extension **never sends image data outside your device**. All processing
happens locally in the browser. See [PRIVACY.md](./PRIVACY.md) for details.

## Development & Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and conventions.
Release flow is documented in [docs/RELEASE.md](./docs/RELEASE.md).

## License

[MIT](./LICENSE) © 2026 Photo EXIF Util Contributors
