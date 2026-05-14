/**
 * Timetable.jsx — Module root. Owns all timetable state.
 *
 * Data shape (permanent event):
 *   { id, groupId, day, start, end, title, category, color, notes,
 *     notify, notifyBefore }
 *
 * groupId links multi-day events created together. Editing fetches all events
 * sharing a groupId; saving wipes them all and creates fresh ones.
 *
 * Temp events extend with: { isTemp: true, endDate, notifyAt }.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Confirm, Toggle } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { uid, getTodayDayName } from '../../utils.js'
import { loadJSON, saveJSON, Storage, KEYS } from '../../storage.js'
import DayView from './DayView.jsx'
import EventForm from './EventForm.jsx'
import TempForm from './TempForm.jsx'
import { DAYS } from './data.js'
import { rescheduleAll } from './notifications.js'

const KEY_NOTIFY_ON = KEYS.TT_NOTIFY_ON
const KEY_GOALS = KEYS.GOALS_ACTIVE

export default function Timetable() {
  const [loaded, setLoaded] = useState(false)
  const [events, setEvents] = useState([])
  const [tempEvents, setTempEvents] = useState([])
  const [goals, setGoals] = useState([])
  const [selectedDay, setSelectedDay] = useState(getTodayDayName())
  const [notifyOn, setNotifyOn] = useState(true)

  const [view, setView] = useState('day') // 'day' | 'settings'
  const [modal, setModal] = useState(null) // { type: 'add'|'edit'|'temp', ... }
  const [confirmDel, setConfirmDel] = useState(null) // { ids: [...], label }

  // ── Load on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [ev, te, n, gl] = await Promise.all([
        loadJSON(KEYS.TT_EVENTS, []),
        loadJSON(KEYS.TT_TEMP, []),
        Storage.get(KEY_NOTIFY_ON),
        loadJSON(KEY_GOALS, []),
      ])
      // Drop expired temp events
      const now = new Date()
      const live = te.filter(e => !e.endDate || new Date(e.endDate) > now)
      setEvents(ev)
      setTempEvents(live)
      setGoals(gl)
      setNotifyOn(n === null ? true : n === 'true')
      setLoaded(true)
    })()
  }, [])

  // Refresh goals when this tab becomes visible (cheap — re-reads from
  // storage on visibility change). This keeps the linked-goal subtitles
  // in sync if the user edits goals on another tab.
  useEffect(() => {
    function refresh() {
      if (document.visibilityState === 'visible') {
        loadJSON(KEY_GOALS, []).then(setGoals)
      }
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  // ── Persist + reschedule notifications ───────────────────────────────────
  useEffect(() => { if (loaded) saveJSON(KEYS.TT_EVENTS, events) }, [events, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.TT_TEMP, tempEvents) }, [tempEvents, loaded])
  useEffect(() => { if (loaded) Storage.set(KEY_NOTIFY_ON, String(notifyOn)) }, [notifyOn, loaded])
  useEffect(() => {
    if (loaded) rescheduleAll(events, tempEvents, notifyOn, goals)
  }, [events, tempEvents, notifyOn, goals, loaded])

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleAddEvent(form) {
    const groupId = uid('grp')
    const created = form.days.map(day => ({
      id: uid('ev'),
      groupId,
      day,
      title: form.title,
      category: form.category,
      color: form.color,
      start: form.start,
      end: form.end,
      notes: form.notes,
      notify: form.notify,
      notifyBefore: form.notifyBefore,
    }))
    setEvents(prev => [...prev, ...created])
    setModal(null)
  }

  function handleEditEvent(form) {
    // Wipe all siblings, recreate with form data.
    const oldGroupId = modal.event.groupId
    const groupId = uid('grp') // fresh groupId for the new set (cleaner — old IDs gone)
    setEvents(prev => {
      const without = prev.filter(e => e.groupId !== oldGroupId)
      const created = form.days.map(day => ({
        id: uid('ev'),
        groupId,
        day,
        title: form.title,
        category: form.category,
        color: form.color,
        start: form.start,
        end: form.end,
        notes: form.notes,
        notify: form.notify,
        notifyBefore: form.notifyBefore,
      }))
      return [...without, ...created]
    })
    setModal(null)
  }

  function handleDeleteEvent() {
    const groupId = modal.event.groupId
    const siblings = events.filter(e => e.groupId === groupId)
    setConfirmDel({
      ids: siblings.map(e => e.id),
      label: siblings.length > 1
        ? `Delete all ${siblings.length} occurrences of "${modal.event.title}"?`
        : `Delete "${modal.event.title}"?`,
    })
  }

  function confirmDelete() {
    const ids = new Set(confirmDel.ids)
    setEvents(prev => prev.filter(e => !ids.has(e.id)))
    setConfirmDel(null)
    setModal(null)
  }

  function handleAddTemp(form) {
    setTempEvents(prev => [...prev, {
      id: uid('tmp'),
      isTemp: true,
      day: form.day,
      title: form.title,
      category: form.category,
      color: form.color,
      start: form.start,
      end: form.end,
      notes: form.notes,
      notify: form.notify,
      notifyBefore: form.notifyBefore,
      endDate: form.endDate,
      notifyAt: form.notifyAt,
    }])
    setModal(null)
  }

  function handleDeleteTemp(id) {
    setTempEvents(prev => prev.filter(e => e.id !== id))
  }

  /** When opening edit, enrich the event with all siblings' days. */
  function openEdit(ev) {
    const siblings = events.filter(e => e.groupId === ev.groupId)
    setModal({
      type: 'edit',
      event: {
        ...ev,
        days: siblings.map(s => s.day),
        siblingCount: siblings.length,
      },
    })
  }

  if (!loaded) return null

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>Timetable</div>
        {view === 'day' ? (
          <button style={S.iconBtn} onClick={() => setView('settings')}>
            <Icon name="settings" size={20} />
          </button>
        ) : (
          <button style={S.iconBtn} onClick={() => setView('day')}>
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      {view === 'day' && (
        <DayView
          events={events}
          tempEvents={tempEvents}
          goals={goals}
          selectedDay={selectedDay}
          onDayChange={setSelectedDay}
          onAddEvent={(day) => setModal({ type: 'add', day })}
          onEditEvent={openEdit}
          onAddTemp={(day) => setModal({ type: 'temp', day })}
          onDeleteTemp={handleDeleteTemp}
        />
      )}

      {view === 'settings' && (
        <SettingsView
          notifyOn={notifyOn} setNotifyOn={setNotifyOn}
          eventCount={events.length} tempCount={tempEvents.length}
        />
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <EventForm
          isEdit={false}
          initial={{ day: modal.day }}
          onSave={handleAddEvent}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <EventForm
          isEdit={true}
          initial={modal.event}
          onSave={handleEditEvent}
          onDelete={handleDeleteEvent}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'temp' && (
        <TempForm
          defaultDay={modal.day}
          onSave={handleAddTemp}
          onCancel={() => setModal(null)}
        />
      )}

      {confirmDel && (
        <Confirm
          title="Delete event?"
          message={confirmDel.label}
          onCancel={() => setConfirmDel(null)}
          onConfirm={confirmDelete}
          danger
        />
      )}
    </div>
  )
}

// ── Settings view (in-module, simple) ────────────────────────────────────────

function SettingsView({ notifyOn, setNotifyOn, eventCount, tempCount }) {
  return (
    <div style={S.scroll}>
      <div style={{ ...S.card, marginTop: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Notifications</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 4, lineHeight: 1.4 }}>
              Master switch. When off, no event notifications fire regardless of per-event settings.
              On Android only — has no effect on the web preview.
            </div>
          </div>
          <Toggle on={notifyOn} onChange={setNotifyOn} color={T.timetable} />
        </div>
      </div>

      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Stats
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{eventCount}</div>
            <div style={{ fontSize: 12, color: T.text3 }}>weekly events</div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{tempCount}</div>
            <div style={{ fontSize: 12, color: T.text3 }}>active one-offs</div>
          </div>
        </div>
      </div>

      <div style={{
        ...S.card, fontSize: 12, color: T.text3, lineHeight: 1.5,
      }}>
        Custom template save/load coming in a later stage. For now, use the global
        Backup feature in Home → Settings to snapshot your timetable along with the
        rest of your data.
      </div>
    </div>
  )
}
