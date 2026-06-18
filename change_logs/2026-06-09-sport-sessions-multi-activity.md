# Gym — multi-activity sport sessions

## What's new

- A sport session now works like a workout: it has a **name** (e.g. "Football
  training") and holds **multiple activities**, each measured its own way.
  Before, one session = one activity.
- New **Sets × reps** mode for the basic "3 sets of 5" case (e.g. figure 8s),
  sitting alongside the existing detailed sets mode (per-set reps / seconds /
  distance, for things like sprints).
- The session card shows the session name plus a rolled-up summary
  ("3 activities · 30 min · 5 sets · 15 reps") and lists the activity names
  underneath when there's more than one.
- "Copy last <name> session" prefill, mirroring the workout logger.
- Goal auto-increment now matches a linked event against the session name
  **and** every activity inside it (not just a single activity name).

## Files to add to your project

Copy these into `superapp/src/sections/gym/`, overwriting the existing ones:

```
src/sections/gym/SportLogger.jsx   ← REPLACES existing (rewritten)
src/sections/gym/data.js           ← REPLACES existing
src/sections/gym/Gym.jsx           ← REPLACES existing
src/sections/gym/ProgressView.jsx  ← REPLACES existing
```

No new dependencies. No `npm install` needed. Vite hot-reloads on save.

## Try it

1. Open the **Gym** tab, tap the yellow ⚡ (log sport session)
2. Name the session "Football training"
3. Tap **+ Add activity** → pick or create **Juggling** (mode: Duration), enter
   30 minutes
4. Tap **+ Add activity** again → create **Figure 8's** (mode: Sets × reps),
   enter 3 sets × 5 reps
5. Tap **Log session** — the Sessions list shows one card,
   "Football training · 2 activities · 30 min · 3 sets · 15 reps"
6. Tap the card to edit; tap an activity in the Activities tab to see its
   progress chart pick up the new entry

## Data model change (important)

The sport session shape changed from flat to nested:

```
old:  { kind:'sport', activityId, name, mode, ...modeData, notes }
new:  { kind:'sport', name, notes, activities:[ { activityId, name, mode, ...modeData } ] }
```

Mode-specific data per activity entry:

```
duration:  { minutes }
distance:  { distance, unit, minutes }
setsreps:  { setCount, repsPerSet }            // the new basic mode
sets:      { sets:[{ reps?, seconds?, distance? }], unit? }   // detailed
```

**Migration is automatic and one-way.** On load, every existing flat sport
session is wrapped into a one-activity session (`migrateSportSession` in
`data.js`); the upgraded shape is written back the next time the session list
saves. `sportActivities()` also reads either shape defensively, so nothing
breaks mid-migration. The basic mode deliberately uses `setCount` /
`repsPerSet` rather than the detailed mode's `sets[]` array so the two never
collide.

## On Android

Pure UI + data-model change, no native surface touched — behaves the same in
the WebView as in the browser. One caveat: if you want an export backup as a
safety net before the first save migrates your old sessions, note that the
Android export still silently fails (the outstanding filesystem/share issue).
Either take the backup from the browser/PWA build, or wait until that fix lands.
