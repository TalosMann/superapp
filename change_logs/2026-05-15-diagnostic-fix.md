# Diagnostic + likely fix for Android backup failure

The "encryption" we were using wasn't real — `createConnection(name, true, passphrase, 1, false)` was passing the passphrase as the `mode` argument. The Capacitor SQLite plugin expected `mode` to be `'no-encryption' | 'encryption' | 'secret' | 'newsecret'`. Real encryption requires a separate `setEncryptionSecret` call before connection.

This wasn't catching errors visibly because every `Storage.set` had a `try/catch` that logged but didn't re-throw, so failures were invisible.

## What this patch changes

**`src/storage.js`** — Two real fixes:
- Switched to `'no-encryption'` mode (data on disk in `personal.db` is plain SQLite). Real encryption can be a future stage if you want it.
- Errors now propagate instead of getting silently swallowed. Verbose console logging at every step.

**`src/backup.js`** — Verbose logging in `restoreBackup`, plus a verify step that reads one key back after the write to confirm it persisted.

**`src/sections/Home.jsx`** — Pre-restore safety backup failure no longer aborts the restore (we log it and continue). Verbose logging at every step of `confirmRestore`. Confirm button now says "Restore" instead of "Delete."

**`src/shared.jsx`** — `Confirm` component gains a `confirmLabel` prop for non-Delete confirms.

## Files to update

```
src/storage.js              ← REPLACES
src/backup.js               ← REPLACES
src/shared.jsx              ← REPLACES
src/sections/Home.jsx       ← REPLACES
```

## ⚠ Important: about your existing Android data

The old encrypted SQLite database is at `databases/personal.db` on your phone. Since the encryption was misconfigured, it's possible:

- The database file exists but is unreadable from the new code (mode mismatch on open) — would explain everything you saw
- The database was actually being opened but writes were failing for another reason

Either way, the safest approach is to **clear the app's data once** before installing the new APK:

1. On phone: Settings → Apps → Personal → Storage → Clear data
2. Install the new APK
3. Open the app — fresh empty state
4. Import your backup JSON

You're not losing anything — your data is in the backup file. The clear-data step just ensures the new (unencrypted) code doesn't trip over the old (encrypted-attempt) DB file.

## How to verify on the next run

After the new APK is installed, open Personal, then go to `chrome://inspect` and open DevTools console on your phone. You should see, as the app boots:

```
[Storage] initializing SQLite connection...
[Storage] passphrase length: 47
[Storage] isConnection result: false
[Storage] created new (unencrypted) connection
[Storage] db opened
[Storage] table ready
```

When you import the backup and tap Restore:

```
[confirmRestore] START
[confirmRestore] writing pre-restore safety backup...
[confirmRestore] pre-restore saved: download personal-backup-2026-05-15-pre-restore.json
[confirmRestore] calling restoreBackup...
[restore] START — keys in backup: 12
[restore] wiping 17 known keys...
[restore] wipe complete
[restore] writing personal.timetable.events (47821 chars)
[restore] writing personal.timetable.temp (89 chars)
... (one line per key)
[restore] DONE — wrote 12 keys
[restore] verify read of timetable.events — got 47821 chars
[confirmRestore] restoreBackup completed, reloading in 1.5s
```

If you see this output the restore worked. The app reloads and your data should appear.

If any step shows an error, paste me the lines and I'll patch that specific failure.

## Rebuild + install steps

```powershell
cd D:\Projects\superapp
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Then on phone: clear app data, install new APK, open app, import backup. Watch console.
