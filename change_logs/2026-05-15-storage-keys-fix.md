# Storage keys fix — the actual final fix

The "Connection already exists" bug was real and the singleton fix solved it. But my fix was based on a stale storage.js that was missing critical keys added in Stages 3 and 4 — specifically `TT_NOTIFY_ON`, `GOALS_ACTIVE`, `GOALS_ARCHIVE`. So when modules referenced those keys, they got `undefined`, and calls like `Storage.set(undefined, ...)` hit SQLite's NOT NULL constraint.

This is the error you just saw: `[Storage.set] failed for undefined : NOT NULL constraint failed: store.key`.

The Timetable notify-toggle effect was writing `Storage.set(KEYS.TT_NOTIFY_ON, ...)` where `KEYS.TT_NOTIFY_ON` was undefined. Same problem (silent) affected the Goals module — it was trying to read/write to undefined keys, so its data wasn't persisting across reloads.

## What this fixes

The storage.js in this patch is built from Stage 3's complete keys list (which has `TT_NOTIFY_ON`, `GOALS_ACTIVE`, `GOALS_ARCHIVE`, all the Stage 3+4 additions) PLUS the singleton/retrieve-first fix from the previous patch.

It also adds a guard: any call to `Storage.set`, `get`, or `remove` with a null/undefined/empty key logs a loud error and refuses to act, instead of letting it hit SQLite. This means if any future bug introduces another bad key, you'll see exactly which one in the console.

## File

```
src/storage.js   ← REPLACES the storage.js you currently have
```

## Steps

```powershell
cd D:\Projects\superapp
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Install the new APK over the existing app. **No need to clear data** — your data from the successful restore is already there, this just fixes the lookups.

After installing, open the app. The Timetable notify toggle should work. The Goals tab should show your restored goals correctly (with your "Apply to 5 internships" etc).

If you see fresh `[Storage.set] called with bad key: undefined` messages in the console for keys other than what I've fixed, paste them — there might be one or two more callers I missed.

## Status check

After this patch lands, every module should:
- Persist its data across app restarts
- Survive backup + restore correctly
- Not produce "NOT NULL constraint" or "Connection already exists" errors

If that all works, we're back on track for Stage 5 (Finance port).
