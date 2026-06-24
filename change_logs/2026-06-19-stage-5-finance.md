# 2026-06-19 — Stage 5: Finance module

## Summary

Ports TalosFinance (standalone app) into Personal as the Finance tab.
Same feature set — dashboard, transactions, budgets, income, reports, savings
goals, debt payoff calculator, bills, settings — rebuilt on Personal's storage
layer and visual conventions, with six fixes to bugs found during the port.

## New files

```
src/sections/finance/
├── Finance.jsx        Module root — state, sub-tabs, Dashboard/Transactions/
│                      Budgets/Income/Reports/Bills/Settings views, modal routing
├── SavingsDebt.jsx     Savings goals + debt payoff calculator (avalanche/snowball)
├── FinanceModals.jsx   Tx/Budget/Savings/Contribution/Debt/Bill/Asset/Category forms
├── notifications.js    Bill reminders + persisted budget/savings alert dedup
└── data.js             Categories, seed data, calculations, payoff/ETA math
```

`App.jsx` updated: Finance added to `BUILT_TABS`, `Finance` rendered for the
`finance` tab (previously a stub).

## Data model

Single blob under the already-reserved `KEYS.FIN_DATA` (`personal.finance.data`):

```js
{
  transactions: [{ id, date, desc, amount, type:'income'|'expense', categoryId, tags }],
  budgets:      [{ id, categoryId, limit, period:'monthly', rollover:false }],
  savings:      [{ id, name, target, current, deadline, color, monthlyContrib }],
  debts:        [{ id, name, balance, rate, minPayment, type }],
  bills:        [{ id, name, amount, dueDay, categoryId }],
  assets:       [{ id, name, value }],
  categories:   [{ id, name, color, builtin }],
  settings:     { currency: 'USD' },
  alerts:       { firedBudget: [string], firedSavings: [string] },
}
```

First load with no existing `FIN_DATA` seeds this shape directly — there was
no live Finance data in Personal to migrate from, so no migration path was
needed.

## Fixes made during the port (vs. the original TalosFinance source)

1. **IDs.** Replaced the original's in-memory incrementing counter (reset to
   the same range every cold start — a real collision risk with backup/restore)
   with Personal's `uid()` (timestamp + random suffix), matching every other
   module.
2. **Categories by ID, not name.** Transactions/budgets/bills now reference
   `categoryId`. Renaming a category no longer silently breaks every budget
   and bill that referenced its old name.
3. **Notification dedup persisted.** Budget-alert and savings-milestone
   "already fired" state lives in `FIN_DATA.alerts` instead of an in-memory
   `Set` — the original re-fired every notification on every cold start if
   you were already over a threshold.
4. **Bill due-day math handles real month lengths.** `billDueInfo()` in
   `data.js` clamps to the actual day count of the month (28–31), instead of
   assuming every month has 30 days as the original did in two separate
   places (UI "days until due" and notification scheduling).
5. **Security layer dropped, not ported.** TalosFinance's own `LockScreen.jsx`
   (PIN + biometric) and SQLCipher-encrypted SQLite are not included. Personal
   already has Stage 6 scoped for a single app-wide lock screen and real
   encryption — building a second, module-local one now would conflict with
   that later. Finance data sits behind Personal's existing (currently
   unencrypted) storage layer like every other module until Stage 6.
6. **Own JSON export/import dropped.** The original's Settings tab wrote its
   own blob/anchor JSON export and did unvalidated `JSON.parse` on import —
   the exact Android-silent-failure pattern just fixed in `backup.js`,
   reintroduced locally, and redundant with Personal's existing unified
   backup (Home → Settings → Export backup now), which already covers every
   module including Finance. CSV transaction export was kept (genuinely
   distinct — spreadsheet-friendly, not a full-state backup) and routed
   through `backup.js`'s native-safe write path instead of a raw blob/anchor
   click, so it doesn't silently fail on Android either.

## Naming changes

- **"Goals" → "Savings".** TalosFinance's savings-goal tab was called "Goals",
  which collides with Personal's own Goals module (daily/weekly/monthly tiers)
  already in the bottom nav. Renamed throughout (tab label, component name,
  storage key `savings` instead of `goals`).

## Notifications

Two different patterns, deliberately:
- **Bill reminders** — recurring, cancel-all-then-reschedule on every bill
  change (same pattern as Timetable's notifications), scheduled at 8:00am on
  the (month-length-clamped) due day, repeating monthly.
- **Budget alerts / savings milestones** — one-shot, fire once when a
  threshold is crossed, deduped via persisted keys in `FIN_DATA.alerts`
  (`"<id>-<month>"` for budgets, resets monthly; `"<id>-<pct>"` for savings,
  fires once ever per milestone).

## UI

Restyled to Personal's `theme.js` (`T`/`S`) and shared `Modal`/`Confirm`/
`EmptyState` components throughout, replacing TalosFinance's standalone CSS
classes (`.card`, `.btn-p`, `.inp`, `.sel`, `.chip`, etc.) and inline hex
colors. Finance's own sub-navigation is a horizontally-scrollable tab strip
inside the module (Dashboard / Transactions / Budgets / Income / Reports /
Savings / Debt / Bills / Settings) — same pattern Gym uses for its
Sessions/Exercises/Activities tabs, scaled up for Finance's larger tab count.

## Known limitations carried over (not in scope for this stage)

- Category-by-name fragility is fixed for the data model, but there's still
  no "merge duplicate categories" UI if a user creates near-duplicate custom
  categories.
- No recurring-transaction auto-logging (e.g. auto-post salary monthly) —
  matches TalosFinance's original roadmap, never built there either.
- No CSV *import* — only export. Bulk bank-statement import was on
  TalosFinance's original roadmap as unbuilt; still unbuilt here.

## Files changed

- **New:** `src/sections/finance/{Finance.jsx, SavingsDebt.jsx, FinanceModals.jsx, notifications.js, data.js}`
- **Modified:** `src/App.jsx` — Finance added to `BUILT_TABS`, rendered for the `finance` tab

## Android note

No new native dependencies — Finance uses the existing storage layer and the
already-installed `@capacitor/filesystem` / `@capacitor/share` (via `backup.js`'s
`exportNative`) for CSV export. Standard build:

```
npm run cap:sync
cd android && .\gradlew.bat assembleDebug
```
