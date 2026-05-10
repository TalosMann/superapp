# Personal — your unified life-tracking super-app

A single React + Vite + Capacitor app that merges Timetable, Finance, Nutrition, Gym, and Goals into one place — your "personal Odoo".

---

## Build progress

| Module      | Status          | Notes |
|-------------|-----------------|-------|
| **Foundation** | ✅ Built     | Storage layer, theme, shared components, navigation shell |
| **Nutrition**  | ✅ Built     | Daily logging, body weight, food library, trend charts, day-type targets |
| Dashboard      | 🔲 Stage 4   | Cross-module summary screen |
| Timetable      | 🔲 Stage 5   | Port from existing Timetable app |
| Finance        | 🔲 Stage 5   | Port from existing TalosFinance app |
| Gym tracker    | 🔲 Stage 2   | Workouts (sets/reps/weight) + sport sessions (time played) |
| Goals          | 🔲 Stage 3   | Daily / weekly / monthly tiers |
| Accomplishments / Badges | 🔲 Stage 3 | Custom badges, greyed until earned |
| Lock screen    | 🔲 Stage 6   | Port from existing TalosFinance app |

---

## Stage 1 — what's working right now

**Try it:** `npm install && npm run dev` then open the **Nutrition** tab.

### Nutrition module features

**Day view** — log breakfast, lunch, dinner, snacks per day. Each item tracks name, grams, calories, protein. Date stepper to navigate any day. Live calorie + protein progress vs target.

**Day-type switcher** — three buttons at the top: Rest (1900/185), Normal (2100/200), Active (2300/200). The targets at the top adjust instantly. You can edit these in Settings.

**Body weight tile** — tap to log today's weight in kg. Survives day-to-day for the trend chart.

**Quick add** — fast entry for one-off foods. Type name, grams, calories, protein, save. Optional toggle to also save it to the food library.

**Food library** — saved foods with cal/protein per 100g. When adding from library, just enter grams and the math is done for you. Searchable.

**Trend view** — switch between 7/14/30 day windows. Calorie bars, protein bars, body weight line. Average calories, average protein, weight delta over the range. Reference lines at 2100 kcal and 200g protein.

**Settings** — edit the calorie + protein target for each day type.

### Data shape

All data persists locally. On web (`npm run dev`) it uses `localStorage`. On Android it'll use AES-256 encrypted SQLite (same setup as your TalosFinance app).

```
personal.nutrition.logs    → { 'YYYY-MM-DD': { breakfast: [Item], lunch, dinner, snacks, dayType } }
personal.nutrition.weights → { 'YYYY-MM-DD': number }
personal.nutrition.targets → { rest, normal, active: { cal, protein } }
personal.nutrition.foods   → [{ id, name, defaultGrams, calPer100g, proteinPer100g }]
```

---

## Project structure

```
personal/
├── package.json
├── vite.config.js
├── capacitor.config.ts
├── index.html
└── src/
    ├── main.jsx            React entry
    ├── App.jsx             Shell with bottom nav
    ├── theme.js            Unified color palette + style fragments
    ├── utils.js            Date / number / ID helpers
    ├── storage.js          SQLite + localStorage abstraction
    ├── Icon.jsx            SVG icon set
    ├── shared.jsx          Modal, Toggle, ProgressBar, Stat, Confirm, EmptyState
    └── sections/
        └── Nutrition.jsx   Full Nutrition module
```

The other modules will land in `src/sections/` as new files (Timetable, Finance, Gym, Goals, Dashboard) over the next stages.

---

## Run it

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. All Nutrition features work in the browser.

For Android (later, after we've built more modules):

```bash
npm run build
npx cap add android
npm run cap:android
```

---

## What's next

Tell me which module to build next and I'll send the next file in the same style. My recommendation order:

1. **Gym tracker** — small, well-scoped, lots of data structure to design (gym vs field workout types, exercise library, set/rep logging)
2. **Goals + Accomplishments** — these go together, daily/weekly/monthly tiers, custom badges that unlock on accomplishment
3. **Dashboard** — depends on the others being built (it pulls data from each module)
4. **Timetable + Finance** — porting the existing apps into the shell, adapting them to the new storage layer + theme

Or if you want to run Nutrition for a few days first to feel out the design, that works too.
