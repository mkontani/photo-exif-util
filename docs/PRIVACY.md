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

## Host Permissions

This extension declares `host_permissions: ["*://*/*"]` (http and https URLs).

**Justification**: This permission is required to fetch image bytes from user-supplied URLs (typed manually or selected via the right-click context menu) so that EXIF analysis can be performed locally in the browser. Manifest V3 enforces CORS on Background Service Worker `fetch` calls unless the extension holds host permissions for the target origin, which is why this permission is required (not optional).

The permission is used **only**:
- When the user explicitly enters a URL into the side panel input, or
- When the user explicitly activates the right-click context menu on an image.

It is **never** used for passive monitoring, tracking, or any background network activity. All fetches happen through the Background Service Worker; content scripts never receive this permission.

Users who only need to analyze locally uploaded files (drag-and-drop or file picker) are not affected by this permission — local file processing does not perform any network requests.

## Contact

For privacy questions, please open an issue on the GitHub repository.
