# Stage 2 — Timetable module

A reimagined Timetable module: weekly recurring events with multi-day creation, one-off events that auto-expire, categories with smart suggestions, and notifications. Built fresh for the super-app rather than ported, dropping features that didn't fit and upgrading the ones that did.

## Files to add

```
src/App.jsx                              ← REPLACES existing
src/sections/timetable/                  ← NEW folder
  ├── Timetable.jsx
  ├── DayView.jsx
  ├── EventForm.jsx
  ├── TempForm.jsx
  ├── data.js
  └── notifications.js
```

No new dependencies. Vite hot-reloads on save.

## What's included

**Day view** — horizontal day strip at the top (defaults to today, yellow dot marks today regardless of which day you're viewing). Tap a day or swipe left/right to switch. Events sorted by start time. LIVE badge on the current event. Past events on today's day dimmed.

**Recurring events** — tap the purple + FAB. Pick one or more days (with M/W/F, T/Th, Weekdays, Weekend, All quick-selects). All days you pick get one event each, linked by a shared `groupId`. Editing or deleting any of them brings up the whole group together.

**One-off events** — tap the amber ⚡ FAB. Single day, single occurrence. Auto-expire after the end time passes — never visible again the next week.

**Categories** — 10 built-in (Class, Study, Gym, Sport, Routine, Meal, Career, Social, Personal, Other) with their own colors. As you type a title, the form suggests a category from keywords ("push", "schola", "dodgeball", "internship" etc. all trigger). Color follows the category by default; tap a different color swatch to override.

**Notifications** — per-event toggle + timing (0, 5, 10, 15, 30, 60 min before). Master switch in Settings (gear icon top-right). On web the notifications are no-ops; on Android they fire as native local notifications, scheduled to repeat weekly (permanent events) or once (temp events).

**Settings** — global notification toggle, event count stats. Templates and per-event sound selection are deferred to Stage 2b.

## Design changes from the original Timetable

| Original | New | Why |
|---|---|---|
| Sibling detection by content matching | Explicit `groupId` field | Robust — two unrelated events with same title/time/color no longer accidentally linked |
| 6 generic lifestyle templates (Student, Parent, etc.) | None for now | You're one specific person, not a market segment |
| Onboarding template picker on first launch | Empty timetable by default | The super-app may have a different first-launch experience |
| Single-file `App.jsx` containing everything | Split across `Timetable.jsx`, `DayView.jsx`, `EventForm.jsx`, etc. | Keeps each file under 300 lines |
| Internal `view` state for routing | Modals for transient actions, internal views only for sustained ones | Matches the rest of the super-app's pattern |
| Per-event sound selection + 6 sound files | Deferred | Most people don't change notification sounds |
| Routine checklists | Dropped (moving to Goals module) | Goals module is the right home for checklists |
| Capacitor Preferences for storage | Unified `personal.timetable.*` keys in our storage layer | One backup captures everything |

## Notable design decisions

**Today is the default view.** Open the Timetable tab → you land on today, not Monday. Small thing, big UX win.

**Categories drive color, not the other way around.** Pick a category → color follows. Override color independently if you want. Most people will never touch the color picker.

**Past events get dimmed only on today's day.** Tomorrow's morning events at 6am aren't dim when you look at Tuesday from Monday afternoon. Only "past for today" is past.

**Web notifications are no-ops.** No fake browser permission prompts, no fake notifications. The Capacitor LocalNotifications module only runs on Android; on web you'll see `[notif]` log lines in the console confirming the schedule would have happened.

**`groupId` for multi-day events.** When you create a Monday/Wednesday/Friday workout, the three events share a `groupId`. Editing or deleting brings up the whole group ("Edit (3× weekly)" or "Delete all 3 occurrences"). When you save edits, the old group is wiped and a fresh group with a new `groupId` is created — cleaner than tracking which sibling is "the original."

## Data shapes

```js
// Permanent event
{
  id:           'ev_abc',
  groupId:      'grp_xyz',  // shared across multi-day siblings
  day:          'Monday',
  start:        '06:00',
  end:          '07:00',
  title:        'Push (Armour)',
  category:     'gym',
  color:        '#ef4444',
  notes:        '',
  notify:       true,
  notifyBefore: 10,
}

// Temporary event
{
  ...permanent fields,
  id:        'tmp_abc',
  isTemp:    true,
  endDate:   '2026-05-12T07:00:00.000Z',  // when to auto-expire
  notifyAt:  '2026-05-12T05:50:00.000Z',  // one-time notification time
}
```

Stored under `personal.timetable.events` and `personal.timetable.temp` respectively. Both included in the global backup automatically.

## What's coming

- **Stage 2b (later):** Custom templates — save the current week as "Term 1", switch to "Holiday mode", switch back. Per-event sound selection. Per-event notification overrides UI.
- **Stage 3 (next):** Goals module. Will add the goal-subtitle slot on event cards (the empty `{/* Goal subtitles slot */}` comment in `DayView.jsx`) and extend the notification body to mention attached goals.

## Try it

1. Open the **Timetable** tab — empty day view, today selected
2. Tap the + FAB, fill out: title "Push (Armour)", category auto-suggests "Gym" once you type "push", pick Mon/Wed/Fri via the M/W/F preset, set time 06:00–07:00
3. Save — you'll see "Push (Armour)" appear on Mon, Wed, Fri (swipe or tap the day strip to check)
4. Tap the event on any day → "Edit (3× weekly)" modal opens with all three days pre-selected
5. Try ⚡ for a one-off: "Doctor appointment" on Thursday, set 14:00–15:00, save
6. Switch to Thursday — both your recurring events and the one-off appear, sorted by time
7. Hit settings (gear top-right) — toggle notifications, see stats
