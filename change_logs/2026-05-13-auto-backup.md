# Stage 4b — Auto-backup + configurable destination

Auto-backup runs on app open with Off/Daily/Weekly/Monthly frequencies. Both manual and auto exports honor a user-chosen destination folder. Versioned filenames so older backups are preserved.

## Files

```
src/autoBackup.js              ← NEW (scheduling + directory handle persistence)
src/backup.js                  ← REPLACES (adds `location` field to return value)
src/sections/Home.jsx          ← REPLACES (new settings UI, auto-check on mount)
```

No new dependencies.

## What's new

**Choose backup folder** (Chrome/Edge only) — Settings → Backup destination → "Choose folder" opens native folder picker. Once granted, all exports (manual and auto) write there directly. Falls back to Downloads if permission is lost (e.g. after a browser restart).

**Auto-backup frequency** — Settings → Automatic backups → Off / Daily / Weekly / Monthly. Default is Weekly. Triggers on app open if enough time has passed since the last auto-backup.

**Toast notification** — when an auto-backup fires, a green toast appears at the bottom for 3.5 seconds: "Auto-backup saved (24 kB)". No interruption to whatever you're doing.

**Last-backup display** — settings shows "Last auto-backup: 3 days ago" so you know it's working.

**Versioned filenames** — `personal-backup-2026-05-13.json`. Each day gets its own file. The pre-restore safety backup gets a `-pre-restore` suffix as before.

## How the "pick a folder" feature works

Modern browsers (Chrome, Edge) support the File System Access API. When you click "Choose folder," a native folder picker opens. You select e.g. `D:\Drive\Backups\Personal`. The browser remembers this folder handle in IndexedDB and uses it for all future exports.

**Permission gotcha:** browser security resets the permission when you fully close and reopen the browser. The first auto-backup attempt after a browser restart will silently fail and fall back to Downloads — no popup, no error. If you want to refresh the permission, just hit "Choose folder" again and pick the same folder; takes 2 clicks.

On Firefox/Safari (no File System Access API), the "Choose folder" button is replaced with a note: "Custom folder requires Chrome or Edge."

## Auto-backup mechanics

On app open, the Home component runs `checkAndRun()` once per session. It checks:
1. Frequency is not "off"
2. `(now - lastAutoBackup) >= configured days`

If both true → exports a backup, updates `lastAuto` timestamp, shows toast. Else → silent no-op.

The `window.__autoBackupChecked` flag prevents the check from firing twice if the Home component remounts (e.g. navigating away and back). One check per page load.

## What I'd flag

**The "Daily" frequency is "≥1 day," not "every calendar day."** If you open the app at 11pm Monday, then again at 1am Tuesday, that's 2 hours apart — no second backup. The system checks elapsed days, not date boundaries. Probably what you want, but worth knowing.

**Browser permission resets are surprising.** If you set up a folder, use it for a week, then your auto-backup silently stops landing there (it'll still happen, just in Downloads). The settings panel will still show the folder name. The fix is to re-pick the folder; we don't automatically detect this and warn you, because doing so would require pinging the permission API on every settings open, which is fiddly.

**Auto-backup runs on app START, not in the background.** If you don't open the app for 3 weeks, the weekly auto-backup doesn't fire 3 times — it fires once, on the next open. Web apps can't run code while closed. For "real" continuous backup, you'd need Electron.

**Multiple browser sessions don't deduplicate.** If you have the PWA open in two windows, both will check on open and *both* might trigger a backup. Edge case, but if you see two files in a row, that's why.

**`pre-restore` safety backup uses the same destination.** It now honors your chosen folder too, not just Downloads.

## Try it

1. Open Home → gear icon for Settings
2. Scroll to **Backup destination** → click "Choose folder" → pick e.g. your Drive's Backups folder
3. Click "Export backup now" → check the folder, file lands there
4. **Automatic backups** → tap "Daily" (for testing — change to Weekly after)
5. Close the app entirely (close the PWA window or the browser tab)
6. Reopen → wait a moment → green toast appears at bottom: "Auto-backup saved"
7. Check the folder → today's auto-backup file is there

To test the fallback: change your browser's default download folder, restart the browser, reopen the app. Auto-backup falls back to Downloads silently.

## What's next

We can keep going with Stage 5 (Finance port), or take a moment to live with the app as-is on phone + Windows PWA for a few days and see what feels rough. Up to you.
