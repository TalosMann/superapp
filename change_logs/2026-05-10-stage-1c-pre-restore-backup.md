# Stage 1c — Pre-restore safety backup

Auto-saves a backup of current state immediately before any restore wipes it. Acts as an "undo" if the restore turns out to be wrong.

## Files to overwrite

```
src/backup.js          ← REPLACES existing
src/sections/Home.jsx  ← REPLACES existing
```

No new dependencies, no `npm install` needed. Vite hot-reloads on save.

## What changed

**`backup.js`** — `exportBackup()` now accepts an optional `tag` parameter that gets appended to the filename. So `exportBackup('pre-restore')` saves `personal-backup-2026-05-10-pre-restore.json` instead of the normal `personal-backup-2026-05-10.json`.

**`Home.jsx`** — `confirmRestore()` now runs the safety export first. If that export fails (e.g. browser blocks the download), the restore is aborted with an error — better to bail than to wipe data with no fallback. The confirmation dialog also explicitly tells you the safety backup will be made before you confirm, so you know the safety net exists in advance.

## Try it

1. Add a few nutrition entries
2. Export a normal backup (now your "good state")
3. Add a few more entries
4. Hit **Import backup**, pick a different file or that good-state file
5. Confirmation dialog now mentions the safety backup
6. Confirm — you'll see TWO files in Downloads: the pre-restore one and the older one if you exported earlier
7. App reloads with the imported state
8. To undo: hit Import again, pick the `*-pre-restore.json` file, confirm — back to where you were

## Filename convention

| Trigger                      | Filename                                          |
|------------------------------|---------------------------------------------------|
| User taps Export             | `personal-backup-2026-05-10.json`                 |
| Auto, before any restore     | `personal-backup-2026-05-10-pre-restore.json`     |

If you trigger multiple restores in one day, each new pre-restore export overwrites the previous one (same filename, browser will replace). If you want them all kept, that's a future tweak — add a timestamp like `pre-restore-1430` to the filename.
