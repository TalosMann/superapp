/**
 * notifications.js — Schedule weekly recurring + one-off notifications.
 *
 * Strategy: cancel all known timetable notifications, then schedule from
 * scratch. Same approach as the original timetable; simpler than diffing.
 *
 * On web (dev): no-op + console log so the dev flow doesn't break.
 * On Android: full Capacitor LocalNotifications integration.
 *
 * IDs are deterministic so we can find what we scheduled. Permanent events
 * use ID = first 30 bits of a hash; temp events get the timestamp + a flag bit.
 * (We never need to read them back individually — we always cancel-all.)
 */

import { Capacitor } from '@capacitor/core'
import { DAY_WEEKDAY, CATEGORY_BY_ID } from './data.js'

const isNative = () => Capacitor.isNativePlatform()

// Each scheduled notification needs a 32-bit int ID. We just use a counter
// that resets each rescheduleAll — the cancel-all-then-reschedule pattern
// means we don't need stable IDs across reschedules.
let _idCounter = 1
function nextNotifId() {
  // keep it under 2^31 to avoid integer overflow in Android
  if (_idCounter > 2000000) _idCounter = 1
  return _idCounter++
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Cancel all timetable notifications.
 */
export async function cancelAll() {
  if (!isNative()) { console.log('[notif] cancelAll (web no-op)'); return }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications?.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (e) { console.error('[notif] cancelAll', e) }
}

/**
 * Request permission. Call once before first schedule.
 */
export async function ensurePermission() {
  if (!isNative()) return true
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const perm = await LocalNotifications.requestPermissions()
    return perm.display === 'granted'
  } catch (e) { console.error('[notif] ensurePermission', e); return false }
}

/**
 * Reschedule everything from current state.
 *
 * @param {Array} events     permanent events
 * @param {Array} tempEvents temporary events
 * @param {boolean} enabled  master toggle
 * @param {Array} goals      active goals (for linked-goal mentions in body)
 */
export async function rescheduleAll(events, tempEvents, enabled, goals = []) {
  if (!isNative()) {
    console.log(`[notif] rescheduleAll (web no-op) — ${events.length} perm, ${tempEvents.length} temp, enabled=${enabled}, ${goals.length} goals`)
    return
  }
  await cancelAll()
  if (!enabled) return
  await ensurePermission()

  _idCounter = 1
  const toSchedule = []

  for (const ev of events) {
    if (!ev.notify) continue
    const time = subtractMinutes(ev.start, ev.notifyBefore || 0)
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    toSchedule.push({
      id: nextNotifId(),
      title: ev.title,
      body: buildBody(ev, goals),
      schedule: {
        on: { weekday: DAY_WEEKDAY[ev.day], hour: h, minute: m },
        allowWhileIdle: true,
      },
    })
  }

  const now = new Date()
  for (const ev of tempEvents) {
    if (!ev.notify || !ev.notifyAt) continue
    const when = new Date(ev.notifyAt)
    if (when <= now) continue
    toSchedule.push({
      id: nextNotifId(),
      title: ev.title,
      body: buildBody(ev, goals) + ' (one-off)',
      schedule: { at: when, allowWhileIdle: true },
    })
  }

  if (!toSchedule.length) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({ notifications: toSchedule })
  } catch (e) { console.error('[notif] schedule', e) }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the notification body text. Mentions any active linked goals.
 */
function buildBody(ev, goals = []) {
  const cat = CATEGORY_BY_ID[ev.category]?.label || ''
  const time = `${ev.start} — ${ev.end}`
  const base = cat ? `${time} · ${cat}` : time

  // Find active (not completed) goals linked to this event
  const linked = goals.filter(g => {
    if (!g.linkedEventId) return false
    const matchesEvent = ev.isTemp
      ? g.linkedEventId === ev.id
      : g.linkedEventGroupId === ev.groupId
    if (!matchesEvent) return false
    const done = g.kind === 'check'
      ? g.checkedAt != null
      : (g.progress || 0) >= g.target
    return !done
  })

  if (!linked.length) return base
  if (linked.length === 1) return `${base}\nGoal: ${linked[0].title}`
  return `${base}\n${linked.length} goals active`
}

/**
 * Subtract N minutes from a "HH:MM" string, wrapping through midnight.
 */
function subtractMinutes(time, mins) {
  if (!time) return null
  const [h, m] = time.split(':').map(Number)
  let total = h * 60 + m - mins
  while (total < 0) total += 24 * 60
  const hh = Math.floor(total / 60), mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
