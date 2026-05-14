/**
 * data.js — Goals module constants and period helpers.
 *
 * Tiers define the rollover window:
 *   daily   — period rolls at midnight local time
 *   weekly  — period rolls Monday 00:00
 *   monthly — period rolls on the 1st at 00:00
 *
 * Each goal records the periodId it was created in (e.g. "2026-05-11" for
 * daily, "2026-W19" for weekly, "2026-05" for monthly). On every app load,
 * goals whose periodId is in the past get auto-archived (status: 'missed'
 * if not completed, 'done' if completed).
 */

import { T } from '../../theme.js'

export const TIERS = [
  { id: 'daily',   label: 'Daily',   color: T.goals,    pluralLabel: 'today'      },
  { id: 'weekly',  label: 'Weekly',  color: T.accent,   pluralLabel: 'this week'  },
  { id: 'monthly', label: 'Monthly', color: T.protein,  pluralLabel: 'this month' },
]

export const TIER_BY_ID = Object.fromEntries(TIERS.map(t => [t.id, t]))

export const KINDS = [
  { id: 'check',   label: 'Done / not done' },
  { id: 'counter', label: 'Count toward a target' },
]

// ── Period IDs ────────────────────────────────────────────────────────────

/**
 * Return the current period ID for a tier.
 *  daily   → "2026-05-11"
 *  weekly  → "2026-W19"          (ISO week)
 *  monthly → "2026-05"
 */
export function currentPeriodId(tier, date = new Date()) {
  if (tier === 'daily')   return dailyId(date)
  if (tier === 'weekly')  return weeklyId(date)
  if (tier === 'monthly') return monthlyId(date)
  throw new Error(`Unknown tier: ${tier}`)
}

function dailyId(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function monthlyId(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** ISO week number — Mon as first day, week containing Jan 4 is week 1. */
function weeklyId(d) {
  // Algorithm: shift to Thursday of this week, then count weeks from Jan 4
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = tmp.getUTCDay() || 7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ── Human-readable period labels ─────────────────────────────────────────

export function periodLabel(tier, periodId, now = new Date()) {
  const cur = currentPeriodId(tier, now)
  if (periodId === cur) {
    if (tier === 'daily')   return 'Today'
    if (tier === 'weekly')  return 'This week'
    if (tier === 'monthly') return 'This month'
  }
  // Past period — show a date-ish label
  if (tier === 'daily') {
    const d = new Date(periodId + 'T12:00:00')
    return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
  }
  if (tier === 'weekly')  return periodId.replace('-W', ' · week ')
  if (tier === 'monthly') {
    const [y, m] = periodId.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' })
  }
  return periodId
}
