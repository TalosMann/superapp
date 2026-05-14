# Stage 3 — Goals + dashboard + timetable wiring

A full goals system (daily/weekly/monthly tiers, checkbox or counter), bidirectional integration with the Timetable module, and a real dashboard on the Home tab pulling from both modules.

## Files

```
src/App.jsx                                      ← REPLACES existing
src/storage.js                                   ← REPLACES existing (updated KEYS)
src/sections/Home.jsx                            ← REPLACES existing
src/sections/goals/                              ← NEW folder
  ├── Goals.jsx              (304 lines)
  ├── GoalForm.jsx           (276 lines)
  ├── GoalCard.jsx           (115 lines)
  ├── HistoryView.jsx        (104 lines)
  └── data.js                 (87 lines)
src/sections/timetable/
  ├── DayView.jsx                                ← REPLACES (renders linked goal subtitles)
  ├── Timetable.jsx                              ← REPLACES (loads goals, passes to DayView and notifications)
  └── notifications.js                           ← REPLACES (mentions linked goals in body)
```

No new dependencies. Vite hot-reloads.

## What's in this stage

### Goals module

Three tiers (Daily, Weekly, Monthly) with auto-rollover at midnight / Monday / 1st of month. Each goal is either:

- **Check** — done/not done. Single tap to toggle.
- **Counter** — current/target. Plus and minus buttons. Useful for "apply to 5 internships" (5x) or "go on 2 dates" (2x).

Goals show progress and grouping by tier on the active screen. The **History** tab (top-right icon) shows archived past-period goals with completion stats per period. Status is either `done` or `missed`.

### Linking goals to timetable events

Open the goal form. Tap "Pick an event" — a picker shows your timetable events, deduplicated by groupId (one row per recurring event regardless of how many days it runs on). Pick "Push (Armour)" once and the link captures `linkedEventGroupId`, which means the goal will show as a subtitle on *every* occurrence of that event (Mon, Wed, Fri), not just one specific day's instance.

You can pick recurrence behavior:

- **Once** — goal fires on the next event occurrence, then archives when its period ends.
- **Next N times** — recurring count. When the period ends, if completed, the goal archives and a fresh instance with count - 1 is auto-created for the new period. The recurring goal expires when count reaches 1.

### Timetable integration

Event cards in the Day view now show linked goals as compact green subtitles underneath the event's time/category. Each subtitle has a tiny progress indicator (checkbox or counter `(3/5)`) showing the current state.

The notification body (Android only — web is a no-op) now reads:
- Plain event: `06:00 — 07:00 · Gym`
- Single goal linked: `06:00 — 07:00 · Gym\nGoal: hit 5 reps on dips`
- Multiple goals: `06:00 — 07:00 · Gym\n2 goals active`

### Home tab dashboard

Header now reads **"Today"** (live, actual today). Below:

- **Hero card** — the next upcoming event (or "Now" if one is currently live)
- **Schedule section** — up to 6 of today's events with LIVE badges and goal-count badges
- **Goals section** — per-tier progress bars showing completion ratio (e.g. "Daily 2/4")

The dashboard refreshes whenever you switch back to the Home tab — so if you check off a goal in the Goals tab, then tap Home, the progress bars update.

### Orphan link cleanup

If you delete an event that goals were linked to, the goals don't die — they auto-unlink silently on next load. The goal keeps all its other data; just `linkedEventGroupId` and friends become null. Cleaner than a "this goal's event no longer exists" warning.

## Try it

1. **Open Timetable**, create a recurring event "Push (Armour)" on Mon/Wed/Fri at 06:00–07:00, category Gym
2. **Open Goals**, tap +, title "Hit 5 reps on bodyweight dips", tier Daily, kind Counter, target 5
3. Tap "Pick an event", select Push (Armour)
4. Choose recurrence "Next N times", 3
5. Save
6. **Back to Timetable** — open Monday → you'll see the goal as a green subtitle under the Push event. Same on Wednesday and Friday.
7. **In Goals**, increment the counter a few times. Look at the timetable again — subtitle shows `(2/5)` and a partial state. When you hit 5, it gets crossed out.
8. **Open Home** — the hero card and schedule both show today's status, the goals section shows your daily progress bar.

## Storage shape

```js
// personal.goals.active
[
  {
    id: 'goal_xyz',
    title: 'Hit 5 reps on bodyweight dips',
    tier: 'daily',
    kind: 'counter',
    target: 5,
    progress: 2,
    checkedAt: null,
    periodId: '2026-05-11',
    status: 'active',
    notes: '',
    linkedEventId: 'ev_abc',
    linkedEventGroupId: 'grp_push',
    linkedEventTitle: 'Push (Armour)',
    linkedEventDay: 'Monday',
    recurrence: 'count',
    recurrenceCount: 3,
    createdAt: '2026-05-11T08:30:00.000Z',
  },
  ...
]

// personal.goals.archive — same shape, plus status: 'done' | 'missed'
```

## What I'd flag

**Rollover is lazy.** It runs only when you open the Goals tab. If you don't open it for a week, nothing rolls over until you do — but it'll handle the catch-up correctly when you do open it. This is intentional: simpler than a background task, and there's no scenario where the lazy behavior is actually wrong.

**The orphan cleanup runs on every load of the Goals tab.** Cheap (just a set lookup per goal) but worth knowing if you ever debug "where did my link go" — answer: the event it pointed to got deleted.

**Period IDs use local time.** Daily rollover happens at your phone's midnight, not UTC. ISO week numbering for weeklies. This is what you want for a personal planner — if you fly across timezones, the rollover follows your phone.

**Counter goals with target 1 are equivalent to check goals.** You could enforce target ≥ 2 but I left it permissive — sometimes you want to track "apply to 1 internship" as a counter just to be consistent with the rest.

## What's next

- **Stage 4** — Gym tracker (Push/Pull/Legs/Plyo logging + sport sessions)
- **Stage 5** — Port your existing TalosFinance into the unified shell
- **Stage 6** — Lock screen + global settings polish, then first APK build to live with on phone

Ready when you are.
