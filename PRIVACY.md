# Privacy Policy

## Complete Client-Side Processing

Photo EXIF Util processes all images **entirely on your device**. No image data, metadata, or personal information is ever transmitted to any server.

- No analytics or telemetry of any kind
- No external network requests initiated by the extension
- No data stored outside your browser's local storage
- No third-party services involved in image processing

## Data Handling

| Data Type | Storage | Transmission |
|-----------|---------|-------------|
| Image files | In-memory only, never persisted | Never |
| EXIF metadata | In-memory only | Never |
| User preferences | `chrome.storage.local` (your device only) | Never |

## Optional Host Permissions

This extension declares `optional_host_permissions: ["<all_urls>"]`.

**Justification**: This permission is requested **only when the user explicitly activates** the context menu on an image on a web page. It is used solely to fetch the image bytes for local EXIF analysis. The permission is never used for passive monitoring, tracking, or any background network activity.

The permission is **optional** — users can use the extension via the side panel with locally uploaded files without granting this permission.

## Contact

For privacy questions, please open an issue on the GitHub repository.
