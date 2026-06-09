# Storage singleton fix — Android "Connection already exists" bug

The console output revealed the real bug: every call to `getDB()` was creating a fresh `new SQLiteConnection(CapacitorSQLite)`. The Capacitor SQLite plugin keeps two parallel registries — one inside the JS class, one on the native side. Each new JS wrapper has an empty JS-side registry, so `createConnection` thought it was a fresh call and asked native to create. Native already had a connection from the previous JS wrapper and refused.

That's why you saw `isConnection: false` immediately followed by `createConnection failed: already exists`. Two different consistency checks giving contradictory answers.

## File to update

```
src/storage.js          ← REPLACES (only file changed)
```

No new dependencies.

## What changed

Three fixes in `getDB`:

1. **Module-level singleton `SQLiteConnection` instance.** Only created once. Subsequent calls reuse it, so the JS-side and native-side registries stay aligned.

2. **In-flight init promise.** If `getDB()` is called twice in quick succession (the restore code does exactly this — wipe loop hits storage, then write loop hits storage), the second call awaits the first's init instead of starting a parallel init that races and creates a duplicate.

3. **Try-retrieve-first strategy.** Skip the `isConnection` check entirely (it was lying anyway). Try `retrieveConnection` — if it works, use it. If it fails, create. If create also throws "already exists," close the ghost and recreate.

The end result: storage works first time, every time, on cold and warm starts.

## Steps

1. Drop the new `src/storage.js` into your project
2. Rebuild + install:

```powershell
cd D:\Projects\superapp
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

3. Transfer APK. **You should NOT need to clear app data this time** — the existing DB on the phone is just an empty SQLite file that the previous broken code created and then couldn't reopen. The new code will simply reconnect to it.

4. Open app, do the import. Watch console for:

```
[Storage] initializing SQLite connection...
[Storage] retrieved existing connection (or "created new connection" on first run)
[Storage] db opened
[Storage] table ready
[restore] START — keys in backup: 12
[restore] wiping 19 known keys...
[restore] wipe complete
[restore] writing personal.timetable.events (47821 chars)
... (one line per key)
[restore] DONE — wrote 12 keys
[restore] verify read of timetable.events — got 47821 chars
[confirmRestore] restoreBackup completed, reloading in 1.5s
```

Then the app reloads and your data appears.

## If it still fails

The error message text will tell us what to fix next. The most likely remaining gotcha would be a "database is locked" error during the wipe-then-write phase, which we'd solve with a transaction wrapper. We'll cross that bridge if needed.
