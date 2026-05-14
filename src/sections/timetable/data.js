/**
 * data.js — Timetable constants.
 *
 * Categories are the explicit organizing dimension for events. Each category
 * has a default color; events inherit it but can override. Category keywords
 * power the smart title → category suggestion at add time.
 */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Short labels for the day strip (mobile-friendly)
export const DAY_SHORT = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
}

// Capacitor LocalNotifications uses Sunday=1 … Saturday=7
export const DAY_WEEKDAY = {
  Sunday: 1, Monday: 2, Tuesday: 3, Wednesday: 4,
  Thursday: 5, Friday: 6, Saturday: 7,
}

// ── Categories ───────────────────────────────────────────────────────────────

/**
 * Each category: id, label shown to user, color used for cards/notifications,
 * and a list of title keywords that trigger a smart suggestion.
 */
export const CATEGORIES = [
  { id: 'class',    label: 'Class',    color: '#818CF8', keywords: ['schola', 'nova', 'lecture', 'seminar', 'tutorial', 'class'] },
  { id: 'study',    label: 'Study',    color: '#a78bfa', keywords: ['study', 'revision', 'homework', 'reading', 'french', 'chinese', 'language'] },
  { id: 'gym',      label: 'Gym',      color: '#ef4444', keywords: ['push', 'pull', 'legs', 'gym', 'workout', 'lifting', 'arms', 'chest', 'back'] },
  { id: 'sport',    label: 'Sport',    color: '#fb923c', keywords: ['football', 'soccer', 'dodgeball', 'tennis', 'basketball', 'sport', 'match', 'training', 'plyo', 'plyometric', 'stamina', 'speed', 'shot power', 'ball control', 'curling'] },
  { id: 'routine',  label: 'Routine',  color: '#06c6d4', keywords: ['routine', 'morning', 'evening', 'night', 'wake', 'sleep', 'shower'] },
  { id: 'meal',     label: 'Meal',     color: '#f59e0b', keywords: ['breakfast', 'lunch', 'dinner', 'meal', 'snack', 'food', 'cook'] },
  { id: 'career',   label: 'Career',   color: '#10b981', keywords: ['internship', 'application', 'apply', 'work', 'project', 'borsch', 'interview'] },
  { id: 'social',   label: 'Social',   color: '#ec4899', keywords: ['date', 'dinner with', 'lunch with', 'drinks', 'meet', 'party', 'social', 'call'] },
  { id: 'personal', label: 'Personal', color: '#fbbf24', keywords: ['hobby', 'errand', 'shopping', 'admin', 'chore', 'laundry'] },
  { id: 'other',    label: 'Other',    color: '#64748b', keywords: [] },
]

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]))

/**
 * Suggest a category id from an event title.
 * Returns null if no keyword matches — caller should use 'other' or last-used.
 */
export function suggestCategory(title) {
  if (!title) return null
  const t = title.toLowerCase()
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (t.includes(kw)) return cat.id
    }
  }
  return null
}

// ── Notification timing options ──────────────────────────────────────────────

export const NOTIFY_OPTIONS = [
  { value: 0,  label: 'At start time' },
  { value: 5,  label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
]

// ── Multi-day quick-select shortcuts ─────────────────────────────────────────

export const DAY_PRESETS = [
  { label: 'Weekdays', days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  { label: 'Weekend',  days: ['Saturday', 'Sunday'] },
  { label: 'All',      days: [...DAYS] },
  { label: 'M/W/F',    days: ['Monday', 'Wednesday', 'Friday'] },
  { label: 'T/Th',     days: ['Tuesday', 'Thursday'] },
]
