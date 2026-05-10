/**
 * utils.js — Shared helpers used across all modules.
 */

// ── ID generation ────────────────────────────────────────────────────────────

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// ── Date helpers ─────────────────────────────────────────────────────────────

export function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function dateStr(d) {
  if (typeof d === 'string') return d.split('T')[0]
  return d.toISOString().split('T')[0]
}

export function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export function fmtDateLong(s) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateMD(s) {
  if (!s) return ''
  const d = new Date(s + 'T12:00:00')
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', weekday: 'short' })
}

export function timeToMin(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export function fmtTime(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`
}

export function getTodayDayName() {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
}

// Get start of week (Monday) as YYYY-MM-DD
export function weekStart(d = new Date()) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return dateStr(date)
}

// Get start of month as YYYY-MM-DD
export function monthStart(d = new Date()) {
  const date = new Date(d)
  date.setDate(1)
  return dateStr(date)
}

// Days between two YYYY-MM-DD strings
export function daysBetween(a, b) {
  const da = new Date(a + 'T12:00:00')
  const db = new Date(b + 'T12:00:00')
  return Math.round((db - da) / (1000 * 60 * 60 * 24))
}

// Get last N days as array of YYYY-MM-DD (oldest first)
export function lastNDays(n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push(dateStr(d))
  }
  return out
}

// ── Number formatting ───────────────────────────────────────────────────────

export function fmtNum(n, decimals = 0) {
  if (n == null || isNaN(n)) return '0'
  return Number(n).toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

export function pct(num, den) {
  if (!den) return 0
  return Math.min(100, Math.round((num / den) * 100))
}
