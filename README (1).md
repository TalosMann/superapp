# Personal — unified life-tracking super-app

A single **React + Vite + Capacitor** Android app that merges Timetable, Nutrition,
Gym, and Goals into one place — your "personal Odoo" — with a local-first storage
layer and full JSON backup/restore. Finance and a lock screen are planned but not
yet built.

> **Naming note.** A few names diverge across the project, all referring to the
> same app:
> - Internal/product name: **Personal**
> - Repo / project folder: **`superapp/`**
> - Android app: `appId` **`com.superapp.app`**, `appName` **`SuperApp`** (in `capacitor.config.ts`)
> - Storage namespace: **`personal.*`** keys
>
> If you ever want these unified, the Android `appId`/`appName` are the loose ends.

---

## Status overview

| Area | Status | Notes |
|------|--------|-------|
| **Foundation** | ✅ Built | Storage layer, theme, shared components, nav shell, icons |
| **Nutrition** | ✅ Built | Daily logging, body weight, food library, trend charts, day-type targets |
| **Timetable** | ✅ Built | Recurring + one-off events, categories, notifications, `groupId` linking |
| **Goals** | ✅ Built | Daily/weekly/monthly tiers, check + counter, timetable linking, history |
| **Gym** | ✅ Built | Workouts (sets/reps/weight), multi-activity sport sessions, progress charts |
| **Home / Dashboard** | ✅ Built | Cross-module summary: next event, schedule, goal progress, training |
| **Backup / restore** | ✅ Built | Manual export/import, pre-restore safety backup, scheduled auto-backup |
| **Finance** | 🔲 Pending | Stage 5 — port of TalosFinance. Storage key reserved (`FIN_DATA`), tab stubbed |
| **Lock screen / PIN** | 🔲 Pending | Stage 6. `PIN_HASH` key reserved; `biometric-auth` dependency already installed |
| **Badges / Accomplishments** | 🔲 Pending | `BADGES` key reserved; no UI yet |

The bottom-nav order is: **Home · Timetable · Finance · Nutrition · Gym · Goals**.
Finance renders a "coming in a future build stage" stub.

---

## Tech stack

- **React** 18.3 + **Vite** 5.4 (`@vitejs/plugin-react`)
- **Capacitor** 6 (core, android, app, device, preferences, local-notifications)
- **@capacitor-community/sqlite** 6 — native storage
- **@aparajita/capacitor-biometric-auth** 9 — installed for the future lock screen, not wired up yet
- **recharts** 2.12 — progress/trend charts
- No UI framework — styling is inline via a shared theme (`theme.js`: palette `T`, style fragments `S`)

**Android build toolchain:** Gradle **8.7** + Android Gradle Plugin **8.5.2**
(Gradle 9.x is incompatible with Capacitor 6 — do not upgrade). WebView remote
debugging is enabled in `MainActivity.java` for `chrome://inspect`.

**Primary test device:** Samsung Galaxy S23 Ultra (Android).

---

## Project structure

```
superapp/
├── package.json
├── vite.config.js
├── capacitor.config.ts
├── index.html
├── android/                      Capacitor Android project (Gradle 8.7 / AGP 8.5.2)
└── src/
    ├── main.jsx                  React entry
    ├── App.jsx                   Shell + bottom nav (6 tabs, Finance stubbed)
    ├── theme.js                  Unified palette (T) + style fragments (S)
    ├── utils.js                  Date / number / ID helpers
    ├── Icon.jsx                  SVG icon set
    ├── shared.jsx                Modal, Toggle, ProgressBar, Stat, Confirm, EmptyState
    ├── storage.js                Storage abstraction + KEYS table
    ├── backup.js                 Export / import / restore / stats
    ├── autoBackup.js             Scheduled auto-backup + File System Access folder
    └── sections/
        ├── Home.jsx              Dashboard
        ├── Nutrition.jsx         Nutrition module (single file)
        ├── timetable/
        │   ├── Timetable.jsx     Main module (loads goals, passes to DayView + notifications)
        │   ├── DayView.jsx       Day strip + event cards + linked-goal subtitles
        │   ├── EventForm.jsx     Recurring event create/edit
        │   ├── TempForm.jsx      One-off event create/edit
        │   ├── data.js           Categories, weekday helpers
        │   └── notifications.js  Local-notification scheduling (Android)
        ├── goals/
        │   ├── Goals.jsx         Main module (tiers, rollover)
        │   ├── GoalForm.jsx      Create/edit + event linking
        │   ├── GoalCard.jsx      Single goal row
        │   ├── HistoryView.jsx   Archived past-period goals
        │   └── data.js           Tier + period helpers
        └── gym/
            ├── Gym.jsx           Main module (Sessions/Exercises/Activities tabs)
            ├── WorkoutLogger.jsx Workout session modal
            ├── SportLogger.jsx   Sport session modal (multi-activity)
            ├── ProgressView.jsx  Per-exercise + per-activity charts
            └── data.js           Constants, starter libraries, stat math
```

---

## Storage layer

A single abstraction (`src/storage.js`) backs every module:

- **Web (`npm run dev`)** → `localStorage`
- **Android (Capacitor)** → `@capacitor-community/sqlite`, a single `store(key TEXT PRIMARY KEY, value TEXT)` table

Public API: `Storage.get / set / remove / clearAll`, plus JSON convenience
helpers `loadJSON(key, fallback)` and `saveJSON(key, value)`.

Hard-won robustness baked in (see the storage changelogs):

- **Singleton SQLite connection.** One module-level `SQLiteConnection` + an
  in-flight init promise, with a try-retrieve-first strategy. This is what fixed
  the Android "Connection already exists" / `isConnection: false` contradiction.
- **Null-key guard.** Any `get/set/remove` with a null/undefined/empty key logs
  loudly and refuses, instead of hitting SQLite's `NOT NULL` constraint. This
  caught the `TT_NOTIFY_ON` / `GOALS_*` undefined-key bug.

> ⚠ **Encryption is currently OFF on Android, despite appearances.** The SQLite
> connection is created with `'no-encryption'`, so `personal.db` is plain SQLite
> on disk. Two stale signals say otherwise and should be cleaned up: the header
> comment in `storage.js` still says "AES-256 encrypted," and
> `capacitor.config.ts` sets `CapacitorSQLite.androidIsEncryption: true`. Real
> encryption (a proper `setEncryptionSecret` + `'encryption'` mode) is deferred
> to a future stage. The `getPassphrase()` helper exists but is unused.

### Storage keys

| Module | Key constant | String |
|--------|--------------|--------|
| Timetable | `TT_EVENTS` | `personal.timetable.events` |
| | `TT_TEMP` | `personal.timetable.temp` |
| | `TT_ACC` | `personal.timetable.acc` |
| | `TT_ONBOARDED` | `personal.timetable.onboarded` |
| | `TT_SOUND` | `personal.timetable.sound` |
| | `TT_NOTIFY_ON` | `personal.timetable.notify_on` |
| Finance *(reserved)* | `FIN_DATA` | `personal.finance.data` |
| Nutrition | `NUT_LOGS` | `personal.nutrition.logs` |
| | `NUT_WEIGHTS` | `personal.nutrition.weights` |
| | `NUT_TARGETS` | `personal.nutrition.targets` |
| | `NUT_FOODS` | `personal.nutrition.foods` |
| Gym | `GYM_SESSIONS` | `personal.gym.sessions` |
| | `GYM_EXERCISES` | `personal.gym.exercises` |
| | `GYM_SPORTS` | `personal.gym.sports` |
| Goals | `GOALS_ACTIVE` | `personal.goals.active` |
| | `GOALS_ARCHIVE` | `personal.goals.archive` |
| Badges *(reserved)* | `BADGES` | `personal.badges` |
| Global | `SETTINGS` | `personal.settings` |
| | `PIN_HASH` *(reserved)* | `personal.pin` |

Auto-backup also writes three keys directly (not in `KEYS`, and **not** included
in exports): `personal.backup.frequency`, `personal.backup.lastAuto`,
`personal.backup.dirLabel`.

---

## Modules

### Home / Dashboard
Header reads **"Today"** (live). Shows a hero card for the next upcoming event
(or "Now" if one is live), a Schedule section (up to 6 of today's events with
LIVE and goal-count badges), a Goals section with per-tier progress bars, and a
Training summary (last-7-days workout + sport counts, plus a "logged today"
marker). Refreshes whenever you return to the Home tab. Also hosts the Settings /
Backup screen (gear icon, top-right).

### Nutrition
Per-day logging of breakfast/lunch/dinner/snacks (name, grams, calories,
protein) with a date stepper and live progress vs. target. Day-type switcher
(Rest / Normal / Active) flips targets instantly; editable in Settings. Body
weight tile, quick-add with optional save-to-library, searchable food library
(cal/protein per 100g, auto-math by grams), and a 7/14/30-day trend view
(calorie/protein bars, weight line, averages, reference lines). Chained add: Tab
from the Protein field saves the row and keeps the modal open for fast entry.

### Timetable
Weekly recurring events (multi-day creation via M/W/F, weekday, weekend presets;
siblings share a `groupId`) and one-off events that auto-expire after they pass.
10 built-in categories with keyword-based smart suggestion; category drives color
unless overridden. Day view defaults to today. Per-event notifications (Android
local notifications; web is a no-op) with timing offsets. The notification body
mentions any linked goals.

### Goals
Three tiers (Daily / Weekly / Monthly) with lazy auto-rollover (runs when you
open the tab). Each goal is a **check** (toggle) or **counter** (current/target).
Goals can link to a timetable event by `linkedEventGroupId`, so the goal shows as
a green subtitle on every occurrence of a recurring event. Recurrence is "Once"
or "Next N times" (auto-recreates a decremented instance each period). Deleting a
linked event silently orphan-cleans the goal's link on next load. A History view
shows archived periods with done/missed status.

### Gym
Three views — **Sessions** (chronological log), **Exercises** (lifting library),
**Activities** (sport library). Libraries grow as you log and seed once on first
launch. Two loggers via FABs: workout (red dumbbell) and sport (yellow ⚡).

- **Workouts:** pick a type (suggested from Gym-category timetable events, or
  Custom), optional "Copy last <type> session" prefill, then per-exercise sets
  of weight × reps (or reps-only for bodyweight).
- **Sport sessions (multi-activity):** a named session (e.g. "Football training")
  containing multiple activities, each measured by its own mode:
  - `duration` — minutes
  - `distance` — distance + unit + minutes (pace derived)
  - `setsreps` — basic "N sets × M reps"
  - `sets` — detailed per-set reps / seconds / distance
  - Includes a "Copy last <name> session" prefill, like workouts.
- **Progress:** tap any exercise/activity for stat cards, a chart, and tappable
  session history.
- **Goal auto-increment:** saving a new session bumps any linked counter goal by
  1 (conservative: counters only, new sessions only, capped at target). For sport
  it matches the linked event title against the session name **and** every
  contained activity name.

### Backup & restore
- **Manual export** builds a versioned JSON of all `personal.*` keys
  (`personal-backup-YYYY-MM-DD.json`).
- **Import / restore** is a true replace (wipes known keys, then writes the
  backup), with verbose logging and a read-back verify step.
- **Pre-restore safety backup** auto-fires before any restore
  (`…-pre-restore.json`) as an undo.
- **Auto-backup** (`autoBackup.js`) runs once per app launch at Off / Daily /
  Weekly / Monthly (default Weekly), with a toast on success.
- **Custom destination** (Chrome/Edge only) via the File System Access API; the
  directory handle persists in IndexedDB. Falls back to Downloads when the API is
  unavailable or permission lapses.

---

## Key data shapes

```js
// Timetable — permanent event
{ id, groupId, day, start, end, title, category, color, notes, notify, notifyBefore }
// Timetable — temp event: permanent fields + { isTemp:true, endDate, notifyAt }

// Goal (personal.goals.active; archive adds status: 'done'|'missed')
{ id, title, tier, kind, target, progress, checkedAt, periodId, status, notes,
  linkedEventId, linkedEventGroupId, linkedEventTitle, linkedEventDay,
  recurrence, recurrenceCount, createdAt }

// Gym — workout session
{ id, kind:'workout', type, date, notes,
  exercises:[ { exerciseId, name, isBodyweight, sets:[ { weight, reps } ] } ] }

// Gym — sport session (multi-activity)
{ id, kind:'sport', date, name, notes,
  activities:[ { activityId, name, mode, ...modeData } ] }
//   duration: { minutes }
//   distance: { distance, unit, minutes }
//   setsreps: { setCount, repsPerSet }
//   sets:     { sets:[ { reps, seconds, distance } ], unit }

// Gym — library entries
exercise: { id, name, isBodyweight, defaultReps?, defaultWeight?, category? }
activity: { id, name, mode, defaultUnit, color }

// Nutrition
logs    → { 'YYYY-MM-DD': { breakfast:[Item], lunch, dinner, snacks, dayType } }
weights → { 'YYYY-MM-DD': number }
targets → { rest, normal, active: { cal, protein } }
foods   → [ { id, name, defaultGrams, calPer100g, proteinPer100g } ]

// Backup file
{ app:'personal-superapp', version:1, exportedAt, data: { '<key>': <value>, ... } }
```

---

## Run it

**Development (browser):**

```bash
npm install
npm run dev          # http://localhost:5173
```

All modules work in the browser; Android-only paths (SQLite, native
notifications) degrade to localStorage / no-ops.

**Android build:**

```powershell
cd D:\Projects\superapp
npm run cap:sync         # vite build + npx cap sync
cd android
.\gradlew.bat assembleDebug
```

(`npm run cap:android` additionally opens Android Studio.) Transfer the APK from
`android/app/build/outputs/apk/debug/` to the phone and install over the existing
app.

**When to clear app data before installing:** only when the on-disk DB schema /
encryption mode could mismatch the new code (it did during the encryption-mode
switch). For ordinary JS-only changes — including the Gym multi-activity update —
you do **not** clear data; migrations run in-app.

---

## Known issues & gotchas

- **Android export/file-save silently fails. (Top open item.)** The export uses a
  Blob URL + invisible `<a download>` click. That works in desktop browsers but
  does not write a file inside Android's System WebView — and because the JS runs
  without throwing, the success toast still fires, so it *looks* like it worked.
  **Planned fix:** branch on `Capacitor.isNativePlatform()` and route native
  exports through `@capacitor/filesystem` (+ `@capacitor/share`), leaving the
  web/PWA path unchanged. Until then, take backups from the browser/PWA build.
- **Storage is unencrypted on Android** despite the stale "AES-256" comment and
  the `androidIsEncryption: true` config flag (see Storage layer above).
- **Auto-backup runs at app start, not in the background.** Miss three weeks and
  it fires once on next open, not three times. "Daily" means ≥1 day elapsed, not
  per calendar day. Two PWA windows can each fire one. Folder permission resets
  on full browser restart (silently falls back to Downloads; re-pick to restore).
- **Goal auto-increment is best-effort title matching.** The linked event title
  must contain the activity/session name (or vice versa); near-misses like
  "DBall" vs "Dodgeball" won't match.
- **Gym library management isn't built.** Libraries are append-only via the
  loggers — no rename / change-mode / delete-from-library UI yet. An activity's
  mode is fixed once created (changing it would break its progress trail).
- **Today's logged sessions don't surface on the timetable** event cards yet.

---

## Roadmap

- **Stage 5 — Finance:** port TalosFinance into the shell (its own settings,
  data format conversion). `FIN_DATA` key + Finance tab stub already in place.
- **Stage 6 — Lock screen + settings polish:** PIN (`PIN_HASH` reserved) and/or
  biometric unlock (`capacitor-biometric-auth` already installed), then a
  hardened APK.
- **Android export fix** (the open item above) — slated before / alongside Stage 5.
- **Later:** real SQLite encryption, badges/accomplishments UI, gym library
  management, timetable "logged today" surfacing.

---

## Changelog index

Per-change notes live alongside this README (chronological):

| Date | File | Summary |
|------|------|---------|
| 2026-05-10 | `2026-05-10_added_storage.md` | Stage 1b — JSON export/import + Home settings |
| 2026-05-10 | `2026-05-10-stage-1c-pre-restore-backup.md` | Stage 1c — pre-restore safety backup |
| 2026-05-11 | `2026-05-11-nutrition-chained-add.md` | Nutrition — Tab-to-keep-adding |
| 2026-05-11 | `2026-05-11-stage-2-timetable.md` | Stage 2 — Timetable module |
| 2026-05-11 | `2026-05-11-stage-3-goals.md` | Stage 3 — Goals + dashboard + timetable wiring |
| 2026-05-12 | `2026-05-12-stage-4-gym.md` | Stage 4 — Gym module (workouts + sport + progress) |
| 2026-05-13 | `2026-05-13-auto-backup.md` | Stage 4b — auto-backup + configurable destination |
| 2026-05-15 | `2026-05-15-storage-singleton-fix.md` | Android "Connection already exists" fix |
| 2026-05-15 | `2026-05-15-storage-keys-fix.md` | Missing storage keys / NOT NULL fix |
| 2026-05-15 | `2026-05-15-diagnostic-fix.md` | Encryption-mode diagnosis + error propagation |
| 2026-06-09 | `2026-06-09-sport-sessions-multi-activity.md` | Gym — multi-activity sport sessions + sets×reps |
```
