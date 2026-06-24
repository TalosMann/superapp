# 2026-06-19 — Android export fix

## Summary

Fixes the long-standing silent export failure on Android. The old code used a
Blob URL + invisible `<a download>` click, which runs without error in
Capacitor's WebView but doesn't produce a file — so the success toast fired
regardless. Replaced with `@capacitor/filesystem` for writing and
`@capacitor/share` for the manual export share sheet.

## Problem

Capacitor's Android WebView intercepts `<a download>` clicks and silently
discards them. No exception is thrown, so the `.then()` success path ran and
the toast showed "Saved personal-backup-…json" even though nothing was written.
Auto-backup had the same bug — every auto-backup since the feature launched has
been a no-op on Android.

## Solution

Three paths are now in play, checked in order:

| Platform | Trigger | Behaviour |
|---|---|---|
| Android | Manual export | `Filesystem.writeFile` → `Documents/superapp_exports/` → `Share.share` sheet |
| Android | Auto-backup / pre-restore | `Filesystem.writeFile` → `Documents/superapp_exports/` (silent) |
| Web (Chrome/Edge) | Any | Existing File System Access API directory write |
| Web (other) | Any | Existing blob `<a download>` → Downloads |

The share sheet on manual export lets you forward the file to Drive, email,
Files, etc. Auto-backup and pre-restore are silent — same as the web Downloads
fallback, no user interaction required.

## Files changed

- **`src/backup.js`** — added `writeNative(filename, json)` (silent write),
  `exportNative(filename, json)` (write + share sheet), and `buildFilename(tag)`
  helper. `exportBackup()` now branches on `isNativePlatform()` before falling
  through to the blob path. Dynamic imports of `@capacitor/filesystem` and
  `@capacitor/share` so the web bundle is unaffected.

- **`src/autoBackup.js`** — `writeBackupToDestination()` gains a `{ share }`
  option (default `false`). On native it takes the new native branch; web paths
  are unchanged. `fsApiSupported()` now also returns `false` on native (belt and
  suspenders). `getBackupDirectoryLabel()` returns `null` on native (no
  directory UI shown).

- **`src/sections/Home.jsx`** — manual export call passes `{ share: true }`.
  "Backup destination" card is hidden on Android (`!onNative` guard) — it's a
  web-only File System Access API feature and irrelevant on device.
  Version bumped to v0.4.2.

## Data model

No changes.

## New dependencies — must install before building

```
npm install @capacitor/filesystem@6.0.4 @capacitor/share@6.0.4
npm run cap:sync
```

Both are `@capacitor/core` v6-compatible. Dynamic imports keep them out of the
web bundle unless running on Android.

## Android note

New Capacitor plugins require `cap sync` to register the native modules before
building. No schema change, no data migration, no need to clear app data.

```
npm install @capacitor/filesystem@6.0.4 @capacitor/share@6.0.4
npm run cap:sync
cd android && .\gradlew.bat assembleDebug
```

Files land in `Documents/superapp_exports/` on the device (visible in Samsung
My Files → Internal storage → Documents → superapp_exports).
