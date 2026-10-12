# Google Drive Save-State Sync — Idle Hacking Suite 2.0.5

Status: **Implemented but cannot be considered authenticated or live verified until an OAuth client is configured and the user completes Google's consent flow.** This feature does not use ChatGPT's Google Drive connector; it works from inside the installed browser extension.

## What is saved

- Selected Suite settings, including optimizer, contracts, Breach, budgets, market controls.
- Sanitized game combat events, outcome/decision telemetry, and other supported local telemetry tables (up to 3,000 most recent rows *per table*, max 24 MiB for the entire snapshot).
- **Never** game login tokens, cookies, WebSocket session IDs or browser HAR recordings.
- Automatic local checkpoints every **15 minutes** in `chrome.storage.local` as long as the extension exists in that profile. The extension's IndexedDB also stores ongoing combat events independently of the Brave Dev Capture HAR files.

**Important:** Local storage DOES NOT survive deleting the entire Brave capture profile. Export the save-state JSON or use Google Drive before deleting/rebuilding a profile.

## Use local backups without a Google login

Open the Control Center **Advanced Controls → Save / Restore Suite State**:
1. Select **Save Local Checkpoint** whenever you want.
2. Select **Export Save State** and store the downloaded JSON somewhere *outside* the ephemeral Brave profile.
3. In a new profile, **Import Save State** to merge telemetry and restore settings. Duplicates are skipped rather than counting fights twice.
4. Use **Restore Local Checkpoint** only if you retained the same browser profile.

## One-time OAuth setup for Google Drive

Chrome's `chrome.identity.getAuthToken` cannot grant Google Drive access with no registered OAuth client. To enable it:

1. Visit `brave://extensions` (or `chrome://extensions`), enable **Developer mode**, and view the **ID** of the installed Idle Hacking Suite extension. Keep that extension ID stable across installs; temporary capture profiles may generate different IDs.
2. In a Google Cloud project you control, enable the **Google Drive API**, configure the OAuth consent screen and required test users if the app is in testing mode, then create an OAuth client of type **Chrome Extension** using that *exact extension ID*.
3. In your **local copy** of `extension/manifest.json`, add this top-level block, substituting your own client ID:

   ```json
   "oauth2": {
     "client_id": "YOUR_GOOGLE_CHROME_EXTENSION_OAUTH_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/drive.file"]
   }
   ```

   This is a *configuration snippet*, not a standalone manifest. Keep the existing `identity` permission and `https://www.googleapis.com/*` host permission. Avoid checking personal login configuration or token exports into Git.
4. Reload the unpacked extension in the browser. From Control Center → **Advanced Controls → Backups & Google Drive**, set the **folder name** (default: `Idle Hacking Suite Backups`) or an existing **folder ID**. A folder ID must be accessible with the application's `drive.file` scope; a new app-created folder is the simplest path.
5. **Save Changes**, then click **Connect Google Drive**, approve Google consent, and click **Back Up to Drive** to confirm a real upload. Once verified, turn on **Automatic Drive sync every 15 minutes**, then Save Changes.
6. On a new authorized profile, click **Restore from Drive**. It applies the saved settings and merges historical telemetry. This restore requires an explicit user confirmation, so older remote preferences do not silently replace local settings.

## How automatic synchronization works

- If you enable auto sync and Google has a valid cached OAuth session, each 15-minute checkpoint performs a background sync.
- The client first downloads any existing remote snapshot and merges missing telemetry *before uploading a new snapshot*. This prevents empty local history from clobbering a rich Google Drive save file after a Brave profile reset.
- Locally changed settings are the primary source for backup writes. Existing Drive settings are restored only on **Restore from Drive** (with confirmation).
- Transient auth/permission/API failures are recorded and visible under **Google Drive Synchronization**. They do **not** interrupt gameplay or erase local history.
- Credentials are kept in the browser's OAuth token cache; the Suite doesn't write them into backup JSON.

## Browser compatibility and remaining verification

Chrome's `identity` implementation is required. Brave builds may differ in OAuth behavior; if the current Brave build doesn't provide `chrome.identity.getAuthToken`, use portable JSON backups. OAuth consent, folder creation, upload, and download require a **real, consented Google login**, so local unit tests alone do not establish Google Drive synchronization actually works on your account.

To verify: connect, upload, inspect the exact file in Google Drive, restore into a **separate disposable test browser profile** without touching your main active game profile, and compare event count + config. Do not test destructive game enhancement or market actions on your production account while verifying backup storage.
