# 2026-06-21 — Stage 6: App lock + encryption-at-rest

## Summary

Adds an app-wide PIN lock gate and turns on real SQLCipher encryption for
the SQLite database, replacing the unencrypted store that's been in place
since the project started. Triggered by the decision to actually publish
Personal rather than keep it personal-only — a PIN screen over an
unencrypted database was assessed as security theater and deliberately not
shipped that way.

## ⚠️ Before you build this — two things to verify first

**1. Back up your data first, independent of this change's own safety net.**
The migration logic below never deletes or modifies your existing database —
but you're about to run brand-new code against real, already-accumulated
data on your actual device, and the cheapest possible insurance is a fresh
manual export. Home → Settings → Export backup now, before installing this
build.

**2. Check `android/app/build.gradle` for the SQLCipher dependency.**
`@capacitor-community/sqlite` needs SQLCipher linked into the native build to
actually support encrypted databases. TalosFinance's original standalone
README called this out as a manual step:
```gradle
dependencies {
    implementation 'net.zetetic:android-database-sqlcipher:4.5.4'
    implementation 'androidx.sqlite:sqlite:2.3.1'
}
```
I can't see your actual `build.gradle` from here to confirm whether this is
already present (`capacitor.config.ts` already has `androidIsEncryption: true`
set, which suggests this may have been anticipated, but I can't verify the
Gradle file itself). If the build fails with a SQLCipher-related
class-not-found error, this is why — add the two lines above and rebuild.

No new npm packages — `@capacitor/preferences` and `@capacitor-community/sqlite`
were already in `package.json`. Still run `cap:sync` before building, per
normal practice for any native-adjacent change:

```powershell
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

## What this actually protects against — and what it doesn't

Said plainly, because overselling security is worse than not having it:

- **Encryption-at-rest (real)**: protects the database file itself from
  leaking on its own — e.g. certain backup mechanisms, or someone copying
  just the `.db` file off the device without going through the app.
- **PIN (UI access gate, not independent cryptography)**: `@capacitor-community/sqlite`
  persists its own encryption secret in Android's native SharedPreferences
  once set — confirmed against the plugin's actual behavior, not assumed.
  That persisted secret isn't gated by this app's PIN screen. So someone with
  full root-level access to the device's app-private storage could retrieve
  that secret directly and decrypt the database without ever knowing the PIN.
  The PIN protects against casual access (picking up the phone, opening the
  app) — it is not a second independent factor protecting the data itself.
- **Biometric unlock was considered and deliberately deferred.** The
  installed plugin (`@aparajita/capacitor-biometric-auth`) only provides a
  yes/no "did the user pass a biometric check" signal — not a hardware-bound
  key release (Android Keystore + `BiometricPrompt.CryptoObject`). Building
  that properly needs custom native code, out of scope for this stage.
- **Forgotten PIN has no recovery by design.** There is no backdoor. Restore
  from a backup if this happens — which is exactly why point 1 above matters.

## New files

```
src/migration.js    One-time migration: old unencrypted DB → new encrypted DB
src/pinAuth.js       PIN setup/verification (PBKDF2, stored via Preferences)
src/LockScreen.jsx   App-wide gate UI: migration status, PIN setup, PIN entry
```

## Modified files

```
src/storage.js   Always opens the encrypted 'personal_secure' database on
                 native now. Dead getPassphrase() (device-ID scheme) removed.
                 PIN_HASH removed from KEYS — it now lives in Preferences,
                 not SQLite (needs to be readable before any DB connection
                 exists at all).
src/App.jsx      Renders <LockScreen> before mounting any module, on native
                 only. Auto-relock after 30s backgrounded (same threshold
                 TalosFinance's original lock screen used).
src/sections/Home.jsx   New "Security" card in Settings: lock/encryption
                        status, "Change PIN" flow.
```

## Migration mechanics (this is the part that touches your real data)

Runs once, automatically, the first time you open the app after this update:

1. Checks a flag in Preferences — if migration already completed, this is a
   complete no-op, every subsequent app start.
2. Generates one random 256-bit passphrase, hands it to the plugin via
   `setEncryptionSecret()` — once, ever.
3. Reads every row out of the **old** unencrypted `personal` database.
4. Writes all of it into a **new** encrypted `personal_secure` database.
5. Reads the new database back and verifies it matches the old one exactly —
   row count and every value, byte for byte.
6. Only if verification passes: marks migration complete. `storage.js`
   starts using `personal_secure` from this point on.

**The old `personal` database is never deleted or modified — by this file or
any other.** If verification ever fails for any reason, migration aborts,
nothing is marked complete, the error is shown on screen with a retry button,
and your data is exactly as it was before. The app will not silently retry
in a loop or fall back to some half-migrated state.

## PIN design

- 6 digits, matching the UX TalosFinance's original lock screen used.
- Hashed with PBKDF2-SHA256, 100,000 iterations, random salt, stored via
  `@capacitor/preferences` — independent of SQLite, since it needs to be
  checkable before any database connection is even attempted.
- "Change PIN" (Home → Settings → Security) requires the current PIN first,
  then a new one twice (create + confirm) — same flow as initial setup.
- No biometric, no recovery code — both deliberately deferred per the
  decisions above.

## Web / dev mode

Completely unaffected. `App.jsx` checks `Capacitor.isNativePlatform()` and
never renders the lock screen on web — `npm run dev` continues to work with
zero friction, same as every other native-only feature in this codebase.

## Known follow-up (not done in this change)

**`MainActivity.java` has WebView remote debugging permanently enabled**
(`setWebContentsDebuggingEnabled(true)`) for `chrome://inspect`. This was fine
for solo development but is a real gap for a published app — anyone with USB
access to the device can attach Chrome DevTools and interact with the running
JS directly, including the lock screen's React state, bypassing the PIN
check at the UI layer entirely (it wouldn't expose the SQLCipher secret
itself, since that's native-side, but it would let someone watch/manipulate
the app while it's "locked"). Wasn't in my project files to edit directly —
gate it behind a debug-only check before shipping:

```java
if (BuildConfig.DEBUG) {
    WebView.setWebContentsDebuggingEnabled(true);
}
```

## Files changed

- **New:** `src/migration.js`, `src/pinAuth.js`, `src/LockScreen.jsx`
- **Modified:** `src/storage.js`, `src/App.jsx`, `src/sections/Home.jsx`
