/**
 * notifications.js — Finance local notifications.
 *
 * Two different patterns, deliberately:
 *
 *   Bill reminders — recurring, tied to a fixed entity (a bill). Cancel-all +
 *   reschedule-from-scratch on every change, same pattern as the Timetable
 *   module. IDs are a session counter (cancel-all means we never need to
 *   address a specific old notification by ID later).
 *
 *   Budget alerts / savings milestones — one-shot, fire exactly once when a
 *   threshold is crossed. TalosFinance tracked "already fired" in an in-memory
 *   Set that reset every cold start, so the same alert would refire on every
 *   app open if you were already over threshold. Here the fired-state is
 *   persisted in FIN_DATA.alerts (an array of string keys) so it survives
 *   restarts. Caller is responsible for saving the returned alerts object.
 *
 * Bill due-day scheduling clamps to the actual day count of the month it's
 * scheduling into (handles Feb / 30-day months) — see billDueInfo in data.js
 * for the equivalent UI-facing calculation.
 */

import { Capacitor } from '@capacitor/core'

const isNative = () => Capacitor.isNativePlatform()

let _idCounter = 1
function nextNotifId() {
  if (_idCounter > 2000000) _idCounter = 1
  return _idCounter++
}

export async function requestNotificationPermission() {
  if (!isNative()) return true
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.requestPermissions()
    return perm.display === 'granted'
  } catch (e) { console.error('[finance/notif] requestPermission', e); return false }
}

// ── Bill reminders ──────────────────────────────────────────────────────────

/**
 * Cancel all previously-scheduled Finance bill notifications, then schedule
 * fresh ones for every bill at 8:00am on its (month-length-clamped) due day,
 * repeating monthly.
 */
export async function syncBillReminders(bills) {
  if (!isNative()) { console.log(`[finance/notif] syncBillReminders (web no-op) — ${bills.length} bills`); return }

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    const ours = (pending.notifications || []).filter(n => n.extra?.source === 'finance-bill')
    if (ours.length) {
      await LocalNotifications.cancel({ notifications: ours.map(n => ({ id: n.id })) })
    }

    _idCounter = 1
    const toSchedule = []
    const now = new Date()

    for (const bill of bills) {
      const thisMonthLen = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const clampedDay = Math.min(bill.dueDay, thisMonthLen)
      const due = new Date(now.getFullYear(), now.getMonth(), clampedDay, 8, 0, 0, 0)
      if (due <= now) due.setMonth(due.getMonth() + 1)

      toSchedule.push({
        id: nextNotifId(),
        title: '💳 Bill Due Today',
        body: `${bill.name} — due today`,
        schedule: { at: due, every: 'month', allowWhileIdle: true },
        smallIcon: 'ic_stat_icon_config_sample',
        extra: { source: 'finance-bill', billId: bill.id },
      })
    }

    if (toSchedule.length) {
      await LocalNotifications.schedule({ notifications: toSchedule })
    }
  } catch (e) { console.error('[finance/notif] syncBillReminders', e) }
}

// ── Budget alerts (persisted dedup) ─────────────────────────────────────────

const BUDGET_ALERT_THRESHOLD = 0.9

/**
 * Fire an immediate notification for any budget that has just crossed 90%.
 * `alerts.firedBudget` holds keys like "<budgetId>-<YYYY-MM>" so the alert
 * fires once per budget per month, surviving app restarts.
 *
 * Returns the (possibly updated) alerts object — caller persists it.
 */
export async function checkBudgetAlerts(budgetHealthArr, alerts) {
  const firedBudget = [...(alerts?.firedBudget || [])]
  const monthKey = `${new Date().getFullYear()}-${new Date().getMonth()}`
  let changed = false

  for (const b of budgetHealthArr) {
    const key = `${b.id}-${monthKey}`
    if (firedBudget.includes(key)) continue
    if (b.pct < BUDGET_ALERT_THRESHOLD * 100) continue

    firedBudget.push(key)
    changed = true

    if (isNative()) {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications')
        await LocalNotifications.schedule({
          notifications: [{
            id: nextNotifId(),
            title: '⚠️ Budget Alert',
            body: `${b.cat.name} is at ${b.pct.toFixed(0)}% of its budget`,
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: 'ic_stat_icon_config_sample',
            extra: { source: 'finance-budget', budgetId: b.id },
          }],
        })
      } catch (e) { console.error('[finance/notif] checkBudgetAlerts', e) }
    }
  }

  return changed ? { ...alerts, firedBudget } : alerts
}

// ── Savings milestones (persisted dedup) ───────────────────────────────────

const MILESTONES = [
  { pct: 50,  emoji: '🎯', label: 'halfway there' },
  { pct: 90,  emoji: '🔥', label: '90% complete' },
  { pct: 100, emoji: '🏆', label: 'complete!' },
]

/**
 * Fire milestone notifications at 50/90/100% of a savings goal's target.
 * `alerts.firedSavings` holds keys like "<savingId>-<pct>" — fires once ever
 * per goal per milestone (milestones don't reset monthly like budgets).
 *
 * Returns the (possibly updated) alerts object — caller persists it.
 */
export async function checkSavingsMilestones(savings, alerts) {
  const firedSavings = [...(alerts?.firedSavings || [])]
  let changed = false

  for (const s of savings) {
    const pct = s.target > 0 ? (s.current / s.target) * 100 : 0
    for (const m of MILESTONES) {
      if (pct < m.pct) continue
      const key = `${s.id}-${m.pct}`
      if (firedSavings.includes(key)) continue

      firedSavings.push(key)
      changed = true

      if (isNative()) {
        try {
          const { LocalNotifications } = await import('@capacitor/local-notifications')
          await LocalNotifications.schedule({
            notifications: [{
              id: nextNotifId(),
              title: `${m.emoji} Savings Milestone`,
              body: `"${s.name}" is ${m.label}!`,
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_stat_icon_config_sample',
              extra: { source: 'finance-savings', savingId: s.id },
            }],
          })
        } catch (e) { console.error('[finance/notif] checkSavingsMilestones', e) }
      }
    }
  }

  return changed ? { ...alerts, firedSavings } : alerts
}
