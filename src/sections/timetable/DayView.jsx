/**
 * DayView.jsx — Day strip + event list for the current day.
 *
 * Horizontal day strip at top (tap or swipe to change day).
 * Sorted event list below: permanent + temp events for that day.
 * "LIVE" badge for events currently happening (only on today's day).
 * Past events on today's day get dimmed.
 * Two FABs: + (permanent event) and ⚡ (temp event).
 */

import { useRef } from 'react'
import { T, S } from '../../theme.js'
import { EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { DAYS, DAY_SHORT, CATEGORY_BY_ID } from './data.js'
import { timeToMin, fmtTime, getTodayDayName } from '../../utils.js'

export default function DayView({
  events, tempEvents, goals, selectedDay, onDayChange,
  onAddEvent, onEditEvent, onAddTemp, onDeleteTemp,
}) {
  const today = getTodayDayName()
  const isToday = selectedDay === today
  const nowMin = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : -1

  // Merge + sort events for the selected day
  const dayEvents = [...events, ...tempEvents]
    .filter(e => e.day === selectedDay)
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start))

  // Swipe-to-navigate
  const touchStart = useRef(null)
  function onTouchStart(e) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  function onTouchEnd(e) {
    if (!touchStart.current) return
    const dx = e.changedTouches[0].clientX - touchStart.current.x
    const dy = e.changedTouches[0].clientY - touchStart.current.y
    touchStart.current = null
    if (Math.abs(dx) < 50) return
    if (Math.abs(dx) <= Math.abs(dy)) return
    const dir = dx < 0 ? 1 : -1
    const i = DAYS.indexOf(selectedDay)
    onDayChange(DAYS[(i + dir + 7) % 7])
  }

  return (
    <>
      {/* Day strip */}
      <div style={{
        display: 'flex', gap: 4, padding: '0 16px 10px', flexShrink: 0,
        overflowX: 'auto',
      }}>
        {DAYS.map(d => {
          const sel = d === selectedDay
          const isTodayDay = d === today
          return (
            <button key={d} onClick={() => onDayChange(d)} style={{
              flex: 1, minWidth: 44, position: 'relative',
              background: sel ? T.timetable : 'transparent',
              color: sel ? '#0a0e15' : T.text2,
              border: `1px solid ${sel ? T.timetable : T.border}`,
              borderRadius: 10, padding: '8px 4px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {DAY_SHORT[d]}
              {isTodayDay && (
                <div style={{
                  position: 'absolute', top: 3, right: 6,
                  width: 5, height: 5, borderRadius: '50%',
                  background: sel ? '#0a0e15' : T.ok,
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px', position: 'relative' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {dayEvents.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={`Nothing on ${selectedDay}`}
            hint="Tap + to add a recurring event, or ⚡ for a one-off"
          />
        ) : dayEvents.map(ev => {
          // Match goals by groupId for permanent events (so a goal linked to a
          // Mon/Wed/Fri event shows on all three days, not just whichever id
          // was picked). Temp events match by direct id.
          const goalsForCard = (goals || []).filter(g => {
            if (!g.linkedEventId) return false
            if (ev.isTemp) return g.linkedEventId === ev.id
            return g.linkedEventGroupId === ev.groupId
          })
          return (
            <EventCard
              key={ev.id} ev={ev}
              isToday={isToday} nowMin={nowMin}
              linkedGoals={goalsForCard}
              onClick={ev.isTemp ? null : () => onEditEvent(ev)}
              onDeleteTemp={ev.isTemp ? () => onDeleteTemp(ev.id) : null}
            />
          )
        })}
      </div>

      {/* FABs */}
      <button onClick={() => onAddTemp(selectedDay)} style={{
        ...S.fab, right: 88, background: T.ok,
        boxShadow: '0 6px 24px rgba(251,191,36,0.35)',
      }} title="One-off event">
        <Icon name="bolt" size={22} color="#1a1208" />
      </button>
      <button onClick={() => onAddEvent(selectedDay)} style={{
        ...S.fab, background: T.timetable,
        boxShadow: '0 6px 24px rgba(129,140,248,0.35)',
      }} title="Recurring event">
        <Icon name="plus" size={26} color="#0a0e15" stroke={3} />
      </button>
    </>
  )
}

// ── EventCard ────────────────────────────────────────────────────────────────

function EventCard({ ev, isToday, nowMin, onClick, onDeleteTemp, linkedGoals = [] }) {
  const startMin = timeToMin(ev.start)
  const endMin = timeToMin(ev.end)
  const live = isToday && nowMin >= startMin && nowMin < endMin
  const past = isToday && nowMin >= endMin

  const cat = CATEGORY_BY_ID[ev.category]
  const color = ev.color || cat?.color || T.text2

  return (
    <div
      onClick={onClick}
      style={{
        background: T.bg2, border: `1px solid ${live ? color : T.border}`,
        borderLeft: `4px solid ${color}`, borderRadius: 10,
        padding: '12px 14px', marginBottom: 8, cursor: onClick ? 'pointer' : 'default',
        opacity: past ? 0.45 : 1,
        boxShadow: live ? `0 0 0 1px ${color}` : 'none',
        transition: 'opacity .2s',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{ev.title}</div>
            {live && (
              <div style={{
                background: color, color: '#0a0e15', fontSize: 9, fontWeight: 800,
                padding: '2px 6px', borderRadius: 4, letterSpacing: '.04em',
              }}>LIVE</div>
            )}
            {ev.isTemp && (
              <div style={{
                background: 'transparent', color: T.ok, fontSize: 9, fontWeight: 800,
                padding: '2px 6px', borderRadius: 4, letterSpacing: '.04em',
                border: `1px solid ${T.ok}`,
              }}>ONE-OFF</div>
            )}
          </div>
          <div className="mono" style={{ fontSize: 12, color: T.text3 }}>
            {fmtTime(ev.start)} – {fmtTime(ev.end)}
          </div>
          {cat && (
            <div style={{ fontSize: 11, color, marginTop: 4, fontWeight: 600 }}>
              {cat.label}
            </div>
          )}
          {ev.notes && (
            <div style={{ fontSize: 12, color: T.text2, marginTop: 6, lineHeight: 1.4 }}>
              {ev.notes}
            </div>
          )}
          {/* Linked goal subtitles */}
          {linkedGoals.length > 0 && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              {linkedGoals.map(g => {
                const done = g.kind === 'check'
                  ? g.checkedAt != null
                  : (g.progress || 0) >= g.target
                return (
                  <div key={g.id} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 11, color: done ? T.good : T.goals,
                    marginTop: 2,
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 6,
                      background: done ? T.good : 'transparent',
                      border: `1.5px solid ${done ? T.good : T.goals}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {done && <Icon name="check" size={8} stroke={3} color="#0a0e15" />}
                    </div>
                    <span style={{
                      textDecoration: done ? 'line-through' : 'none',
                      opacity: done ? 0.7 : 1,
                    }}>
                      {g.title}
                      {g.kind === 'counter' && (
                        <span className="mono" style={{ marginLeft: 4 }}>
                          ({g.progress || 0}/{g.target})
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {onDeleteTemp && (
          <button onClick={(e) => { e.stopPropagation(); onDeleteTemp() }}
            style={{ ...S.iconBtn, color: T.text4, padding: 4 }}>
            <Icon name="trash" size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
