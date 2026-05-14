/**
 * ProgressView.jsx — Progress chart + history + lifetime stats for one
 * exercise (workout) or one activity (sport). Adapts to data type.
 */

import { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { T, S } from '../../theme.js'
import { EmptyState, Stat } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { fmtDate, fmtNum } from '../../utils.js'
import { exerciseProgress, activityProgress } from './data.js'

export function ExerciseProgress({ exercise, sessions, onBack, onOpenSession }) {
  const trail = useMemo(() => exerciseProgress(exercise.id, sessions), [exercise.id, sessions])

  if (trail.length === 0) {
    return (
      <div style={S.scroll}>
        <Header title={exercise.name} subtitle={exercise.isBodyweight ? 'Bodyweight exercise' : 'Weighted exercise'} onBack={onBack} />
        <EmptyState icon="dumbbell" title="No sessions yet"
          hint={`Log a workout that includes ${exercise.name} to start tracking progress.`} />
      </div>
    )
  }

  // Lifetime stats
  const heaviestSet = trail.reduce((m, p) => p.topWeight > m.topWeight ? p : m, trail[0])
  const mostReps = trail.reduce((m, p) => p.topReps > m.topReps ? p : m, trail[0])
  const highestVolume = trail.reduce((m, p) => p.totalVolume > m.totalVolume ? p : m, trail[0])
  const bestEst = trail.reduce((m, p) => p.est1RM > m.est1RM ? p : m, trail[0])

  // Chart data — for bodyweight we chart top reps; for weighted we chart est1RM
  const chartData = trail.map(p => ({
    date: fmtDate(p.date),
    fullDate: p.date,
    value: exercise.isBodyweight ? p.topReps : p.est1RM,
    volume: p.totalVolume,
  }))

  return (
    <div style={S.scroll}>
      <Header
        title={exercise.name}
        subtitle={exercise.isBodyweight ? 'Bodyweight exercise' : 'Weighted exercise'}
        onBack={onBack}
      />

      {/* Hero stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {exercise.isBodyweight ? (
          <>
            <Stat label="Best set" value={`${mostReps.topReps}`} sub="reps" color={T.gym} />
            <Stat label="Sessions" value={trail.length} sub="" color={T.text} />
          </>
        ) : (
          <>
            <Stat label="Est. 1RM" value={`${fmtNum(bestEst.est1RM, 1)}`} sub="kg" color={T.gym} />
            <Stat label="Heaviest" value={`${fmtNum(heaviestSet.topWeight, 1)}`} sub={`kg × ${heaviestSet.topReps}`} color={T.text} />
          </>
        )}
      </div>

      {/* Progress chart */}
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>
          {exercise.isBodyweight ? 'Best set (reps) over time' : 'Estimated 1RM over time'}
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36}
              domain={['dataMin - 1', 'dataMax + 1']} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke={T.gym} strokeWidth={2.5}
              dot={{ fill: T.gym, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* History */}
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 4px 8px' }}>
        Session history
      </div>
      {[...trail].reverse().map(p => (
        <button key={p.sessionId} onClick={() => onOpenSession?.(p.sessionId)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.gym}`,
          borderRadius: 10, padding: '10px 12px', marginBottom: 6,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmtDate(p.date)}</div>
            <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
              Top set: {exercise.isBodyweight
                ? `${p.topReps} reps`
                : `${fmtNum(p.topWeight, 1)}kg × ${p.topReps}`}
              {!exercise.isBodyweight && ` · ${fmtNum(p.est1RM, 1)}kg est. 1RM`}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}

// ── Activity (sport) progress ───────────────────────────────────────────────

export function ActivityProgress({ activity, sessions, onBack, onOpenSession }) {
  const trail = useMemo(() => activityProgress(activity.id, sessions), [activity.id, sessions])

  if (trail.length === 0) {
    return (
      <div style={S.scroll}>
        <Header title={activity.name} subtitle={activity.mode} onBack={onBack} />
        <EmptyState icon="bolt" title="No sessions yet"
          hint={`Log a ${activity.name} session to start tracking.`} />
      </div>
    )
  }

  return (
    <div style={S.scroll}>
      <Header title={activity.name} subtitle={`${activity.mode}${activity.defaultUnit ? ` · ${activity.defaultUnit}` : ''}`} onBack={onBack} />

      {activity.mode === 'duration' && <DurationProgress trail={trail} onOpenSession={onOpenSession} />}
      {activity.mode === 'distance' && <DistanceProgress trail={trail} activity={activity} onOpenSession={onOpenSession} />}
      {activity.mode === 'sets'     && <SetsProgress trail={trail} onOpenSession={onOpenSession} />}
    </div>
  )
}

function DurationProgress({ trail, onOpenSession }) {
  const total = trail.reduce((s, p) => s + p.minutes, 0)
  const longest = trail.reduce((m, p) => p.minutes > m.minutes ? p : m, trail[0])

  const chartData = trail.map(p => ({
    date: fmtDate(p.date),
    minutes: p.minutes,
    sessionId: p.sessionId,
  }))

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Stat label="Total time" value={fmtMinutes(total)} sub="" color={T.gym} />
        <Stat label="Longest" value={`${longest.minutes}`} sub="min" color={T.text} />
        <Stat label="Sessions" value={trail.length} sub="" color={T.text} />
      </div>
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Duration (min)</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="minutes" fill={T.gym} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <HistoryList trail={trail} render={p => (
        <span className="mono">{p.minutes} min</span>
      )} onOpenSession={onOpenSession} />
    </>
  )
}

function DistanceProgress({ trail, activity, onOpenSession }) {
  const totalDist = trail.reduce((s, p) => s + p.distance, 0)
  const longest = trail.reduce((m, p) => p.distance > m.distance ? p : m, trail[0])
  const withPace = trail.filter(p => p.pace)
  const bestPace = withPace.length ? Math.min(...withPace.map(p => p.pace)) : null

  const chartData = trail.map(p => ({
    date: fmtDate(p.date),
    distance: p.distance,
    pace: p.pace,
  }))

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Stat label="Total" value={fmtNum(totalDist, 1)} sub={activity.defaultUnit} color={T.gym} />
        <Stat label="Longest" value={fmtNum(longest.distance, 1)} sub={longest.unit} color={T.text} />
        {bestPace ? (
          <Stat label="Best pace" value={bestPace.toFixed(2)} sub={`min/${activity.defaultUnit}`} color={T.text} />
        ) : (
          <Stat label="Sessions" value={trail.length} sub="" color={T.text} />
        )}
      </div>
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Distance</div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="distance" stroke={T.gym} strokeWidth={2.5}
              dot={{ fill: T.gym, r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <HistoryList trail={trail} render={p => (
        <span className="mono">
          {fmtNum(p.distance, 1)}{p.unit} · {p.minutes}min
          {p.pace && ` · ${p.pace.toFixed(2)} min/${p.unit}`}
        </span>
      )} onOpenSession={onOpenSession} />
    </>
  )
}

function SetsProgress({ trail, onOpenSession }) {
  const totalReps = trail.reduce((s, p) => s + p.totalReps, 0)
  const totalSets = trail.reduce((s, p) => s + p.setCount, 0)
  const mostReps = trail.reduce((m, p) => p.totalReps > m.totalReps ? p : m, trail[0])

  const chartData = trail.map(p => ({
    date: fmtDate(p.date),
    sets: p.setCount,
    reps: p.totalReps,
  }))

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Stat label="Total reps" value={fmtNum(totalReps)} sub="lifetime" color={T.gym} />
        <Stat label="Total sets" value={fmtNum(totalSets)} sub="" color={T.text} />
        <Stat label="Best session" value={fmtNum(mostReps.totalReps)} sub="reps" color={T.text} />
      </div>
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Reps per session</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="reps" fill={T.gym} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <HistoryList trail={trail} render={p => (
        <span className="mono">{p.setCount} sets · {p.totalReps} reps</span>
      )} onOpenSession={onOpenSession} />
    </>
  )
}

// ── Shared header + history list ────────────────────────────────────────────

function Header({ title, subtitle, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <button style={S.iconBtn} onClick={onBack}><Icon name="back" /></button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{title}</div>
        <div style={{ fontSize: 11, color: T.text3 }}>{subtitle}</div>
      </div>
    </div>
  )
}

function HistoryList({ trail, render, onOpenSession }) {
  return (
    <>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '14px 4px 8px' }}>
        Session history
      </div>
      {[...trail].reverse().map(p => (
        <button key={p.sessionId} onClick={() => onOpenSession?.(p.sessionId)} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          background: T.bg2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.gym}`,
          borderRadius: 10, padding: '10px 12px', marginBottom: 6,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{fmtDate(p.date)}</div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{render(p)}</div>
          </div>
        </button>
      ))}
    </>
  )
}

function fmtMinutes(min) {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
