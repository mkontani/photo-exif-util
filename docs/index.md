---
title: Photo EXIF Util
description: Privacy-first Chrome extension for inspecting, stripping, and SNS-optimizing image EXIF metadata — fully client-side.
---

# Photo EXIF Util

Privacy-first Chrome extension that inspects, strips, and SNS-optimizes
image EXIF metadata **entirely on your device**. No image bytes, no
metadata, and no analytics ever leave the browser.

- [Install from the Chrome Web Store](https://chromewebstore.google.com/detail/photo-exif-util/jfofoaeeaeonemgkamhiefekfgfjbamd)
- [Privacy Policy](./PRIVACY)
- [Source code on GitHub](https://github.com/mkontani/photo-exif-util)
- [Release downloads](https://github.com/mkontani/photo-exif-util/releases)

## Privacy at a glance

- All image processing runs in the browser via OffscreenCanvas / pica /
  Web Crypto. No server is involved.
- The extension only fetches images when you explicitly enter a URL or
  use the right-click context menu. Drag-and-drop and the file picker
  never touch the network.
- No telemetry, no analytics, no remote code execution. CSP locks
  `script-src` / `object-src` to `'self'`.

For the full statement, see the [Privacy Policy](./PRIVACY).
