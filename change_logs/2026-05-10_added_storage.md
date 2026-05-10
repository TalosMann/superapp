# Stage 1b — Backup feature

## What's new

- Full export/import of all app data as a JSON file
- Home tab now shows a real screen with a Settings/Backup view (gear icon top-right)
- Storage stats (number of keys, total bytes)

## Files to add to your project

Copy these into your existing `superapp/` folder, overwriting where they exist:

```
src/App.jsx          ← REPLACES existing
src/backup.js        ← NEW
src/sections/Home.jsx ← NEW
```

No new dependencies. No `npm install` needed. Vite hot-reloads on save.

## Try it

1. Tap the **Home** tab in the bottom nav
2. Tap the gear icon top-right
3. Tap **Export backup** — your browser will download `personal-backup-2026-05-10.json` to your Downloads folder
4. Open the file in a text editor — you'll see a structured JSON with all your nutrition data
5. Tap **Import backup** to reverse the process — pick the file, confirm the restore prompt
6. After import, the app reloads automatically so all modules pick up the new state

## On Android (later)

Same code path. The download will land in `/storage/emulated/0/Download/`. The system file picker handles the import. Nothing to change.
