/**
 * data.js — Gym module constants and pure helpers.
 *
 * Two top-level shapes:
 *
 * Workout session:
 *   { id, kind: 'workout', type, date, exercises: [
 *       { exerciseId, name, isBodyweight, sets: [{ weight, reps, notes? }] }
 *   ], notes }
 *
 * Sport session (new multi-activity shape):
 *   { id, kind: 'sport', date, name, notes, activities: [
 *       { activityId, name, mode, ...modeData }
 *   ] }
 *
 *   where each activity entry's mode-specific data is:
 *     duration:   { minutes }
 *     distance:   { distance, unit, minutes }
 *     setsreps:   { setCount, repsPerSet }            // basic "3 sets × 5 reps"
 *     sets:       { sets: [{ reps?, seconds?, distance? }], unit? }  // detailed
 *
 *   Legacy sport sessions were flat (a single activity per session:
 *   { activityId, name, mode, ...modeData }). migrateSportSession() and
 *   sportActivities() transparently upgrade/read those old records.
 *
 * Exercise library entry:
 *   { id, name, isBodyweight, defaultReps, defaultWeight, category, notes }
 *
 * Activity library entry:
 *   { id, name, mode: 'duration'|'distance'|'sets', defaultUnit, color, notes }
 */

// ── Sport modes ─────────────────────────────────────────────────────────────

export const SPORT_MODES = [
  { id: 'duration', label: 'Duration',          shortLabel: 'time' },
  { id: 'distance', label: 'Distance + time',   shortLabel: 'distance' },
  { id: 'setsreps', label: 'Sets × reps',       shortLabel: 'sets×reps' },
  { id: 'sets',     label: 'Sets (detailed)',   shortLabel: 'sets' },
]

export const SPORT_MODE_BY_ID = Object.fromEntries(SPORT_MODES.map(m => [m.id, m]))

// ── Units ───────────────────────────────────────────────────────────────────

export const DISTANCE_UNITS = ['km', 'm', 'mi', 'laps']

// ── Starter libraries (seeded on first launch only if libraries are empty) ──

export const STARTER_EXERCISES = [
  { name: 'Bench press',       isBodyweight: false, category: 'push' },
  { name: 'Overhead press',    isBodyweight: false, category: 'push' },
  { name: 'Dips',              isBodyweight: true,  category: 'push' },
  { name: 'Triceps pushdown',  isBodyweight: false, category: 'push' },
  { name: 'Pull-ups',          isBodyweight: true,  category: 'pull' },
  { name: 'Barbell row',       isBodyweight: false, category: 'pull' },
  { name: 'Lat pulldown',      isBodyweight: false, category: 'pull' },
  { name: 'Barbell curl',      isBodyweight: false, category: 'pull' },
  { name: 'Squat',             isBodyweight: false, category: 'legs' },
  { name: 'Deadlift',          isBodyweight: false, category: 'legs' },
  { name: 'Romanian deadlift', isBodyweight: false, category: 'legs' },
  { name: 'Single-leg squat',  isBodyweight: true,  category: 'legs' },
]

export const STARTER_ACTIVITIES = [
  { name: 'Dodgeball',         mode: 'duration', defaultUnit: null, color: '#fb923c' },
  { name: 'Ball juggles',      mode: 'duration', defaultUnit: null, color: '#fb923c' },
  { name: 'Swimming',          mode: 'distance', defaultUnit: 'm',  color: '#0d9aff' },
  { name: 'Zigzag run',        mode: 'distance', defaultUnit: 'km', color: '#10b981' },
  { name: 'Plyometrics',       mode: 'sets',     defaultUnit: null, color: '#a78bfa' },
  { name: 'Max speed sprints', mode: 'sets',     defaultUnit: 'm',  color: '#ef4444' },
  { name: 'Shot power',        mode: 'sets',     defaultUnit: null, color: '#f59e0b' },
  { name: 'Ball control',      mode: 'duration', defaultUnit: null, color: '#fb923c' },
  { name: 'Curling throw',     mode: 'sets',     defaultUnit: null, color: '#06c6d4' },
]

// ── Session computations ────────────────────────────────────────────────────

/**
 * Estimated 1RM (Epley formula): weight * (1 + reps/30)
 * Returns 0 if either input is invalid. For bodyweight (weight=0), returns reps.
 */
export function estimated1RM(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (r <= 0) return 0
  if (w <= 0) return r  // bodyweight: just rep count
  return Math.round(w * (1 + r / 30) * 10) / 10
}

/**
 * For one exercise within one workout session, return its top-set stats.
 *   - bodyweight: best (reps) across sets
 *   - weighted: best estimated 1RM across sets
 *   - returns { topWeight, topReps, est1RM, totalVolume, totalReps, setCount }
 */
export function exerciseSessionStats(exercise) {
  let topEst1RM = 0
  let topWeight = 0
  let topReps = 0
  let totalVolume = 0
  let totalReps = 0
  let setCount = 0
  for (const set of (exercise.sets || [])) {
    const w = Number(set.weight) || 0
    const r = Number(set.reps) || 0
    if (r <= 0) continue
    setCount++
    totalReps += r
    totalVolume += w * r
    const e = estimated1RM(w, r)
    if (e > topEst1RM) { topEst1RM = e; topWeight = w; topReps = r }
  }
  return { topWeight, topReps, est1RM: topEst1RM, totalVolume, totalReps, setCount }
}

/**
 * Total volume across all exercises in a workout (sum of weight × reps).
 * For bodyweight movements, weight is treated as 0 — so it doesn't pollute
 * the volume metric, but reps still count via totalReps.
 */
export function workoutTotals(session) {
  let volume = 0
  let reps = 0
  let sets = 0
  for (const ex of (session.exercises || [])) {
    const s = exerciseSessionStats(ex)
    volume += s.totalVolume
    reps += s.totalReps
    sets += s.setCount
  }
  return { volume, reps, sets, exerciseCount: session.exercises?.length || 0 }
}

/**
 * Derived stats for ONE activity entry (or a legacy flat sport session —
 * both expose the same { mode, ...modeData } fields).
 *   - duration mode: just minutes
 *   - distance mode: minutes, distance, pace (min/km if unit is km, else null)
 *   - sets mode: totals across sets
 */
export function sportSessionStats(session) {
  if (session.mode === 'duration') {
    return { minutes: Number(session.minutes) || 0 }
  }
  if (session.mode === 'distance') {
    const distance = Number(session.distance) || 0
    const minutes = Number(session.minutes) || 0
    let pace = null
    if (session.unit === 'km' && distance > 0 && minutes > 0) pace = minutes / distance
    if (session.unit === 'mi' && distance > 0 && minutes > 0) pace = minutes / distance
    return { distance, minutes, pace, unit: session.unit }
  }
  if (session.mode === 'setsreps') {
    const setCount = Number(session.setCount) || 0
    const repsPerSet = Number(session.repsPerSet) || 0
    return { setCount, repsPerSet, totalReps: setCount * repsPerSet }
  }
  if (session.mode === 'sets') {
    let totalReps = 0, totalSeconds = 0, totalDistance = 0, setCount = 0
    for (const set of (session.sets || [])) {
      setCount++
      totalReps    += Number(set.reps) || 0
      totalSeconds += Number(set.seconds) || 0
      totalDistance+= Number(set.distance) || 0
    }
    return { setCount, totalReps, totalSeconds, totalDistance, unit: session.unit }
  }
  return {}
}

// ── Multi-activity sport session helpers ────────────────────────────────────

/**
 * Upgrade a legacy flat sport session (single activity per session) into the
 * new multi-activity shape. Idempotent: new-shape sessions and workout
 * sessions pass through unchanged.
 */
export function migrateSportSession(s) {
  if (!s || s.kind !== 'sport') return s
  if (Array.isArray(s.activities)) return s  // already migrated

  const entry = { activityId: s.activityId, name: s.name, mode: s.mode }
  if (s.mode === 'duration') {
    entry.minutes = s.minutes
  } else if (s.mode === 'distance') {
    entry.distance = s.distance
    entry.unit = s.unit
    entry.minutes = s.minutes
  } else if (s.mode === 'sets') {
    entry.sets = s.sets || []
    entry.unit = s.unit || null
  }

  return {
    id: s.id,
    kind: 'sport',
    date: s.date,
    name: s.name || 'Sport session',
    activities: [entry],
    notes: s.notes || '',
  }
}

/**
 * Return a sport session's activity entries, tolerating legacy flat records.
 */
export function sportActivities(session) {
  if (Array.isArray(session?.activities)) return session.activities
  return migrateSportSession(session).activities
}

/**
 * Aggregate display summary for a whole sport session (across its activities).
 * Returns { count, minutes, sets, reps, distance }.
 */
export function sportSessionSummary(session) {
  const acts = sportActivities(session)
  let minutes = 0, sets = 0, reps = 0, distance = 0
  for (const a of acts) {
    const st = sportSessionStats(a)
    minutes += st.minutes || 0
    if (a.mode === 'sets' || a.mode === 'setsreps') { sets += st.setCount || 0; reps += st.totalReps || 0 }
    if (a.mode === 'distance') distance += st.distance || 0
  }
  return { count: acts.length, minutes, sets, reps, distance }
}

/**
 * Most recent sport session matching a session name (case-insensitive).
 * Used by the "Copy last session" prefill in SportLogger.
 */
export function lastSportSession(name, sessions) {
  const key = (name || '').toLowerCase()
  let latest = null
  for (const s of sessions) {
    if (s.kind !== 'sport') continue
    if ((s.name || '').toLowerCase() !== key) continue
    if (!latest || s.date > latest.date) latest = s
  }
  return latest
}

// ── Cross-session aggregations (for progress views) ─────────────────────────

/**
 * For a single exercise across all workout sessions, return [{ date, est1RM, topReps, topWeight, totalVolume }]
 * sorted ascending by date.
 */
export function exerciseProgress(exerciseId, sessions) {
  const out = []
  for (const s of sessions) {
    if (s.kind !== 'workout') continue
    const ex = (s.exercises || []).find(e => e.exerciseId === exerciseId)
    if (!ex) continue
    const stats = exerciseSessionStats(ex)
    if (stats.setCount === 0) continue
    out.push({
      date: s.date,
      est1RM: stats.est1RM,
      topWeight: stats.topWeight,
      topReps: stats.topReps,
      totalVolume: stats.totalVolume,
      totalReps: stats.totalReps,
      sessionId: s.id,
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * For a sport activity, return [{ date, ...stats }] across every session that
 * contains that activity (a session may contain it more than once → one trail
 * point per entry), sorted ascending.
 */
export function activityProgress(activityId, sessions) {
  const out = []
  for (const s of sessions) {
    if (s.kind !== 'sport') continue
    for (const a of sportActivities(s)) {
      if (a.activityId !== activityId) continue
      out.push({ date: s.date, ...sportSessionStats(a), mode: a.mode, sessionId: s.id })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Find the most recent workout session for a given workout type.
 * Returns null if none. Used by "Copy last session" prefill.
 */
export function lastWorkoutOfType(type, sessions) {
  let latest = null
  for (const s of sessions) {
    if (s.kind !== 'workout') continue
    if (s.type !== type) continue
    if (!latest || s.date > latest.date) latest = s
  }
  return latest
}
