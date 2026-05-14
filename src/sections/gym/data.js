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
 * Sport session:
 *   { id, kind: 'sport', activityId, name, date, mode, ...modeData, notes }
 *
 *   where mode-specific data is:
 *     duration:   { minutes }
 *     distance:   { distance, unit, minutes }
 *     sets:       { sets: [{ reps?, seconds?, distance?, unit? }] }
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
  { id: 'sets',     label: 'Sets / reps drill', shortLabel: 'sets' },
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
 * For a sport session: derived stats useful for display.
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
 * For a sport activity, return [{ date, ...stats }] across all sport sessions
 * of that activity, sorted ascending.
 */
export function activityProgress(activityId, sessions) {
  const out = []
  for (const s of sessions) {
    if (s.kind !== 'sport') continue
    if (s.activityId !== activityId) continue
    out.push({ date: s.date, ...sportSessionStats(s), mode: s.mode, sessionId: s.id })
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
