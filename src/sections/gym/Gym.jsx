/**
 * Gym.jsx — Module root for gym + sport tracking.
 *
 * Top tabs:
 *   Sessions    — chronological log of workouts + sport sessions
 *   Exercises   — library of lifting exercises, each tappable for progress
 *   Activities  — library of sport activities, each tappable for progress
 *
 * Two loggers (FABs): workout (+) and sport (⚡).
 *
 * On session save, walks the user's active goals to increment any counter
 * goal whose link points at:
 *   - workout session: linkedEventGroupId matches a gym-category timetable
 *     event of this workout type
 *   - sport session: linkedEventGroupId matches a timetable event AND the
 *     activity's name matches, OR (looser) no link match but title contains
 *     the activity name
 *
 * Auto-increment is conservative: only counter goals (not checkboxes), only
 * goals in the current period, only increments by 1 per session.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Confirm, EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { uid, fmtDate, todayStr } from '../../utils.js'
import { loadJSON, saveJSON, KEYS } from '../../storage.js'
import {
  STARTER_EXERCISES, STARTER_ACTIVITIES,
  workoutTotals, sportSessionStats, SPORT_MODE_BY_ID,
} from './data.js'
import WorkoutLogger from './WorkoutLogger.jsx'
import SportLogger from './SportLogger.jsx'
import { ExerciseProgress, ActivityProgress } from './ProgressView.jsx'

export default function Gym() {
  const [loaded, setLoaded] = useState(false)
  const [sessions, setSessions] = useState([])
  const [exercises, setExercises] = useState([])
  const [activities, setActivities] = useState([])

  const [tab, setTab] = useState('sessions') // 'sessions' | 'exercises' | 'activities'
  const [drill, setDrill] = useState(null)   // { kind: 'exercise'|'activity', id }
  const [modal, setModal] = useState(null)   // { type, initial? }

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [s, e, a] = await Promise.all([
        loadJSON(KEYS.GYM_SESSIONS, []),
        loadJSON(KEYS.GYM_EXERCISES, null),
        loadJSON(KEYS.GYM_SPORTS, null),
      ])
      setSessions(s)
      // First-launch seeding
      setExercises(e === null
        ? STARTER_EXERCISES.map(ex => ({ id: uid('ex'), ...ex }))
        : e)
      setActivities(a === null
        ? STARTER_ACTIVITIES.map(act => ({ id: uid('act'), ...act }))
        : a)
      setLoaded(true)
    })()
  }, [])

  useEffect(() => { if (loaded) saveJSON(KEYS.GYM_SESSIONS, sessions) }, [sessions, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.GYM_EXERCISES, exercises) }, [exercises, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.GYM_SPORTS, activities) }, [activities, loaded])

  // ── Library mutations ─────────────────────────────────────────────────────

  // Add a new exercise — returns the saved exercise (with id) so WorkoutLogger
  // can immediately add it to the current session.
  async function addExercise(newEx) {
    const ex = { id: uid('ex'), ...newEx }
    setExercises(prev => [...prev, ex])
    return ex
  }

  async function addActivity(newAct) {
    const act = { id: uid('act'), ...newAct }
    setActivities(prev => [...prev, act])
    return act
  }

  // ── Session mutations + goal auto-increment ──────────────────────────────

  async function saveSession(data) {
    const isEdit = modal?.type?.endsWith('Edit') && modal.initial
    if (isEdit) {
      setSessions(prev => prev.map(s => s.id === modal.initial.id ? { ...modal.initial, ...data } : s))
    } else {
      const session = { id: uid('sess'), ...data }
      setSessions(prev => [...prev, session])
      // Only auto-increment on NEW session, not on edit
      await maybeIncrementGoals(session)
    }
    setModal(null)
  }

  function deleteSession() {
    setSessions(prev => prev.filter(s => s.id !== modal.initial.id))
    setModal(null)
  }

  async function maybeIncrementGoals(session) {
    const goals = await loadJSON(KEYS.GOALS_ACTIVE, [])
    const events = await loadJSON(KEYS.TT_EVENTS, [])

    let changed = false
    const updated = goals.map(goal => {
      // Only counter goals are auto-incremented
      if (goal.kind !== 'counter') return goal
      // Skip if already complete
      if ((goal.progress || 0) >= goal.target) return goal
      // Must be linked to an event for us to know what it tracks
      if (!goal.linkedEventGroupId) return goal

      // Find the linked event(s) by groupId
      const linkedEvents = events.filter(e => e.groupId === goal.linkedEventGroupId)
      if (linkedEvents.length === 0) return goal
      const linkedTitles = linkedEvents.map(e => e.title.toLowerCase())
      const linkedCategories = linkedEvents.map(e => e.category)

      // Match logic:
      //  - workout session: event must be gym category AND match by workout type
      //  - sport session: event title must contain the activity name (or vice versa)
      let matches = false
      if (session.kind === 'workout') {
        if (linkedCategories.includes('gym') &&
            linkedTitles.includes(session.type.toLowerCase())) {
          matches = true
        }
      } else if (session.kind === 'sport') {
        const name = session.name.toLowerCase()
        for (const t of linkedTitles) {
          if (t.includes(name) || name.includes(t)) { matches = true; break }
        }
      }
      if (!matches) return goal
      changed = true
      return { ...goal, progress: Math.min((goal.progress || 0) + 1, goal.target) }
    })

    if (changed) {
      await saveJSON(KEYS.GOALS_ACTIVE, updated)
    }
  }

  if (!loaded) return null

  // ── Drill-down views ─────────────────────────────────────────────────────

  if (drill?.kind === 'exercise') {
    const ex = exercises.find(e => e.id === drill.id)
    if (!ex) { setDrill(null); return null }
    return (
      <div style={S.screen}>
        <ExerciseProgress
          exercise={ex}
          sessions={sessions}
          onBack={() => setDrill(null)}
          onOpenSession={(sid) => {
            const s = sessions.find(x => x.id === sid)
            if (s) setModal({ type: 'workoutEdit', initial: s })
          }}
        />
      </div>
    )
  }

  if (drill?.kind === 'activity') {
    const act = activities.find(a => a.id === drill.id)
    if (!act) { setDrill(null); return null }
    return (
      <div style={S.screen}>
        <ActivityProgress
          activity={act}
          sessions={sessions}
          onBack={() => setDrill(null)}
          onOpenSession={(sid) => {
            const s = sessions.find(x => x.id === sid)
            if (s) setModal({ type: 'sportEdit', initial: s })
          }}
        />
      </div>
    )
  }

  // ── Main view (Sessions/Exercises/Activities tabs) ───────────────────────

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>Gym</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px', flexShrink: 0 }}>
        {[
          { id: 'sessions', label: 'Sessions' },
          { id: 'exercises', label: 'Exercises' },
          { id: 'activities', label: 'Activities' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1,
            background: tab === t.id ? T.gym : 'transparent',
            color: tab === t.id ? '#fff' : T.text2,
            border: `1px solid ${tab === t.id ? T.gym : T.border}`,
            borderRadius: 10, padding: '8px 4px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'sessions' && (
        <SessionsView
          sessions={sessions}
          activities={activities}
          onEditWorkout={(s) => setModal({ type: 'workoutEdit', initial: s })}
          onEditSport={(s) => setModal({ type: 'sportEdit', initial: s })}
        />
      )}

      {tab === 'exercises' && (
        <LibraryView
          kind="exercise"
          items={exercises}
          sessions={sessions}
          onPick={(ex) => setDrill({ kind: 'exercise', id: ex.id })}
        />
      )}

      {tab === 'activities' && (
        <LibraryView
          kind="activity"
          items={activities}
          sessions={sessions}
          onPick={(a) => setDrill({ kind: 'activity', id: a.id })}
        />
      )}

      {/* FABs — only on Sessions view */}
      {tab === 'sessions' && (
        <>
          <button onClick={() => setModal({ type: 'sport' })} style={{
            ...S.fab, right: 88, background: T.ok,
            boxShadow: '0 6px 24px rgba(251,191,36,0.35)',
          }} title="Log sport session">
            <Icon name="bolt" size={22} color="#1a1208" />
          </button>
          <button onClick={() => setModal({ type: 'workout' })} style={{
            ...S.fab, background: T.gym,
            boxShadow: '0 6px 24px rgba(239,68,68,0.35)',
          }} title="Log workout">
            <Icon name="dumbbell" size={22} color="#fff" />
          </button>
        </>
      )}

      {/* Modals */}
      {(modal?.type === 'workout' || modal?.type === 'workoutEdit') && (
        <WorkoutLogger
          initial={modal.initial}
          sessions={sessions}
          exercises={exercises}
          onAddExercise={addExercise}
          onSave={saveSession}
          onDelete={deleteSession}
          onCancel={() => setModal(null)}
        />
      )}
      {(modal?.type === 'sport' || modal?.type === 'sportEdit') && (
        <SportLogger
          initial={modal.initial}
          activities={activities}
          onAddActivity={addActivity}
          onSave={saveSession}
          onDelete={deleteSession}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ── Sessions view ───────────────────────────────────────────────────────────

function SessionsView({ sessions, activities, onEditWorkout, onEditSport }) {
  const sorted = [...sessions].sort((a, b) => (a.date < b.date ? 1 : -1))

  if (sorted.length === 0) {
    return (
      <div style={S.scroll}>
        <EmptyState icon="dumbbell" title="No sessions logged"
          hint="Tap the red dumbbell to log a workout, or the yellow ⚡ for a sport session." />
      </div>
    )
  }

  // Group by date
  const groups = {}
  for (const s of sorted) {
    if (!groups[s.date]) groups[s.date] = []
    groups[s.date].push(s)
  }

  return (
    <div style={S.scroll}>
      {Object.entries(groups).map(([date, daySessions]) => (
        <div key={date} style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.04em',
            padding: '0 4px 6px',
          }}>
            {date === todayStr() ? 'Today' : fmtDate(date)}
          </div>
          {daySessions.map(s => (
            <SessionCard key={s.id} session={s} activities={activities}
              onClick={() => s.kind === 'workout' ? onEditWorkout(s) : onEditSport(s)} />
          ))}
        </div>
      ))}
    </div>
  )
}

function SessionCard({ session, activities, onClick }) {
  if (session.kind === 'workout') {
    const totals = workoutTotals(session)
    return (
      <div onClick={onClick} style={{
        background: T.bg2, border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${T.gym}`,
        borderRadius: 10, padding: 12, marginBottom: 6,
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ color: T.gym }}><Icon name="dumbbell" size={16} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{session.type}</div>
            <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
              {totals.exerciseCount} exercises · {totals.sets} sets · {totals.reps} reps
              {totals.volume > 0 && ` · ${Math.round(totals.volume)}kg vol`}
            </div>
          </div>
        </div>
      </div>
    )
  }
  // Sport
  const act = activities.find(a => a.id === session.activityId)
  const stats = sportSessionStats(session)
  const accent = act?.color || T.ok
  return (
    <div onClick={onClick} style={{
      background: T.bg2, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 10, padding: 12, marginBottom: 6,
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color: accent }}><Icon name="bolt" size={16} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{session.name}</div>
          <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
            {session.mode === 'duration' && `${stats.minutes} min`}
            {session.mode === 'distance' && (
              `${stats.distance}${stats.unit} · ${stats.minutes}min` +
              (stats.pace ? ` · ${stats.pace.toFixed(2)} min/${stats.unit}` : '')
            )}
            {session.mode === 'sets' && (
              `${stats.setCount} sets · ${stats.totalReps} reps`
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Library view (exercises or activities) ──────────────────────────────────

function LibraryView({ kind, items, sessions, onPick }) {
  const [search, setSearch] = useState('')
  const filtered = items
    .filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Compute session counts per item for the "X sessions" subtitle
  function countSessions(item) {
    if (kind === 'exercise') {
      let n = 0
      for (const s of sessions) {
        if (s.kind !== 'workout') continue
        if ((s.exercises || []).some(e => e.exerciseId === item.id)) n++
      }
      return n
    } else {
      return sessions.filter(s => s.kind === 'sport' && s.activityId === item.id).length
    }
  }

  if (items.length === 0) {
    return (
      <div style={S.scroll}>
        <EmptyState icon={kind === 'exercise' ? 'dumbbell' : 'bolt'}
          title={`No ${kind === 'exercise' ? 'exercises' : 'activities'} yet`}
          hint={`Library grows as you log sessions.`} />
      </div>
    )
  }

  return (
    <div style={S.scroll}>
      <input style={S.input} value={search} onChange={e => setSearch(e.target.value)}
        placeholder={`Search ${kind === 'exercise' ? 'exercises' : 'activities'}...`} />
      <div style={{ height: 12 }} />
      {filtered.map(item => {
        const n = countSessions(item)
        const accent = kind === 'activity' ? (item.color || T.gym) : T.gym
        return (
          <button key={item.id} onClick={() => onPick(item)} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: T.bg2, border: `1px solid ${T.border}`,
            borderLeft: `3px solid ${accent}`,
            borderRadius: 10, padding: 12, marginBottom: 6,
            width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{item.name}</div>
              <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                {kind === 'exercise'
                  ? (item.isBodyweight ? 'bodyweight · ' : '') + `${n} session${n !== 1 ? 's' : ''}`
                  : `${SPORT_MODE_BY_ID[item.mode]?.label} · ${n} session${n !== 1 ? 's' : ''}`
                }
              </div>
            </div>
            {n > 0 && (
              <div style={{ color: T.text4 }}>
                <Icon name="chart" size={16} />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
