/**
 * GoalForm.jsx — Add/edit goal modal.
 *
 * Fields:
 *   title       — required
 *   tier        — daily | weekly | monthly
 *   kind        — check (done/not done) | counter (current/target)
 *   target      — only for counter goals
 *   linkedEventId, linkedEventTitle — optional, picked from timetable
 *   recurrence  — only meaningful if linkedEventId set:
 *                 'once'  — fire on next occurrence then done
 *                 'count' — fire on next N occurrences (recurrenceCount)
 *   notes       — optional
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Toggle } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { loadJSON, KEYS } from '../../storage.js'
import { TIERS, KINDS } from './data.js'

export default function GoalForm({ isEdit, initial, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [tier, setTier] = useState(initial?.tier || 'daily')
  const [kind, setKind] = useState(initial?.kind || 'check')
  const [target, setTarget] = useState(initial?.target || 5)
  const [notes, setNotes] = useState(initial?.notes || '')

  const [linkedEventId, setLinkedEventId] = useState(initial?.linkedEventId || null)
  const [linkedEventGroupId, setLinkedEventGroupId] = useState(initial?.linkedEventGroupId || null)
  const [linkedEventTitle, setLinkedEventTitle] = useState(initial?.linkedEventTitle || '')
  const [linkedEventDay, setLinkedEventDay] = useState(initial?.linkedEventDay || '')
  const [recurrence, setRecurrence] = useState(initial?.recurrence || 'once')
  const [recurrenceCount, setRecurrenceCount] = useState(initial?.recurrenceCount || 3)

  const [showEventPicker, setShowEventPicker] = useState(false)

  function handleSave() {
    if (!title.trim()) return
    onSave({
      title: title.trim(),
      tier,
      kind,
      target: kind === 'counter' ? Math.max(1, Number(target) || 1) : null,
      notes: notes.trim(),
      linkedEventId: linkedEventId || null,
      linkedEventGroupId: linkedEventId ? linkedEventGroupId : null,
      linkedEventTitle: linkedEventId ? linkedEventTitle : null,
      linkedEventDay: linkedEventId ? linkedEventDay : null,
      recurrence: linkedEventId ? recurrence : null,
      recurrenceCount: linkedEventId && recurrence === 'count' ? Math.max(1, Number(recurrenceCount) || 1) : null,
    })
  }

  return (
    <Modal title={isEdit ? 'Edit goal' : 'New goal'} onClose={onCancel} accent={T.goals}>
      {/* Title */}
      <label style={S.label}>Goal</label>
      <input style={S.input} value={title} onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Apply to 5 internships" autoFocus={!isEdit} />

      {/* Tier */}
      <label style={S.label}>How often?</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {TIERS.map(t => (
          <button key={t.id} onClick={() => setTier(t.id)} style={{
            flex: 1,
            background: tier === t.id ? t.color : 'transparent',
            color: tier === t.id ? '#0a0e15' : T.text2,
            border: `1px solid ${tier === t.id ? t.color : T.border}`,
            borderRadius: 8, padding: '10px 4px', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Kind */}
      <label style={S.label}>Type</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {KINDS.map(k => (
          <button key={k.id} onClick={() => setKind(k.id)} style={{
            flex: 1,
            background: kind === k.id ? T.bg3 : 'transparent',
            color: kind === k.id ? T.text : T.text3,
            border: `1px solid ${kind === k.id ? T.borderHi : T.border}`,
            borderRadius: 8, padding: '10px 6px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{k.label}</button>
        ))}
      </div>

      {kind === 'counter' && (
        <>
          <label style={S.label}>Target count</label>
          <input type="number" inputMode="numeric" style={S.inputMono}
            value={target} onChange={e => setTarget(e.target.value)} min="1" />
        </>
      )}

      {/* Event link */}
      <label style={S.label}>Link to timetable event (optional)</label>
      {linkedEventId ? (
        <div style={{
          background: T.bg3, border: `1px solid ${T.timetable}`, borderRadius: 10,
          padding: 12, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{ color: T.timetable }}><Icon name="calendar" size={18} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{linkedEventTitle}</div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
              {linkedEventDay ? `Every ${linkedEventDay}` : 'Linked event'}
            </div>
          </div>
          <button onClick={() => { setLinkedEventId(null); setLinkedEventGroupId(null); setLinkedEventTitle(''); setLinkedEventDay('') }}
            style={{ ...S.iconBtn, color: T.text3 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <button onClick={() => setShowEventPicker(true)} style={{
          width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
          borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <Icon name="calendar" size={16} /> Pick an event
        </button>
      )}

      {/* Recurrence — only shown if linked */}
      {linkedEventId && (
        <>
          <label style={S.label}>How many occurrences?</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setRecurrence('once')} style={{
              flex: 1,
              background: recurrence === 'once' ? T.bg3 : 'transparent',
              color: recurrence === 'once' ? T.text : T.text3,
              border: `1px solid ${recurrence === 'once' ? T.borderHi : T.border}`,
              borderRadius: 8, padding: '10px 4px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Once</button>
            <button onClick={() => setRecurrence('count')} style={{
              flex: 1,
              background: recurrence === 'count' ? T.bg3 : 'transparent',
              color: recurrence === 'count' ? T.text : T.text3,
              border: `1px solid ${recurrence === 'count' ? T.borderHi : T.border}`,
              borderRadius: 8, padding: '10px 4px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Next N times</button>
          </div>
          {recurrence === 'count' && (
            <>
              <div style={{ height: 10 }} />
              <input type="number" inputMode="numeric" style={S.inputMono}
                value={recurrenceCount}
                onChange={e => setRecurrenceCount(e.target.value)} min="1"
                placeholder="3" />
            </>
          )}
        </>
      )}

      {/* Notes */}
      <label style={S.label}>Notes (optional)</label>
      <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
        value={notes} onChange={e => setNotes(e.target.value)} />

      <button onClick={handleSave} disabled={!title.trim()} style={{
        ...S.btnPrimary, marginTop: 18, background: T.goals, color: '#0a0e15',
        opacity: title.trim() ? 1 : 0.5,
      }}>
        {isEdit ? 'Save changes' : 'Add goal'}
      </button>

      {isEdit && (
        <button onClick={onDelete} style={{
          width: '100%', background: 'transparent', border: `1px solid ${T.bad}`,
          borderRadius: 12, padding: 12, marginTop: 8, color: T.bad,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Delete goal</button>
      )}

      {showEventPicker && (
        <EventPicker
          onPick={(ev) => {
            setLinkedEventId(ev.id)
            setLinkedEventGroupId(ev.groupId || ev.id)
            setLinkedEventTitle(ev.title)
            setLinkedEventDay(ev.day)
            setShowEventPicker(false)
          }}
          onCancel={() => setShowEventPicker(false)}
        />
      )}
    </Modal>
  )
}

// ── Event picker ────────────────────────────────────────────────────────────

/**
 * Loads timetable events from storage and shows them grouped by day for picking.
 * Deduplicates multi-day events (same groupId shown once with all its days).
 */
function EventPicker({ onPick, onCancel }) {
  const [events, setEvents] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      const ev = await loadJSON(KEYS.TT_EVENTS, [])
      setEvents(ev)
      setLoaded(true)
    })()
  }, [])

  // Deduplicate by groupId — pick the earliest day for display
  const groups = {}
  for (const e of events) {
    const k = e.groupId || e.id
    if (!groups[k]) groups[k] = { ...e, days: [e.day] }
    else groups[k].days.push(e.day)
  }
  const list = Object.values(groups)
    .filter(g => !search || g.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg2, borderTop: `2px solid ${T.timetable}`,
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 8px', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: T.text }}>Pick an event</div>
          <button style={S.iconBtn} onClick={onCancel}><Icon name="close" /></button>
        </div>
        <div style={{ padding: '0 16px 8px' }}>
          <input style={S.input} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search your timetable..." autoFocus />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
          {!loaded ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.text3 }}>Loading…</div>
          ) : list.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.text3 }}>
              {events.length === 0 ? 'No events in your timetable yet.' : 'No matches.'}
            </div>
          ) : list.map(g => (
            <button key={g.groupId || g.id} onClick={() => onPick(g)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.bg3, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${g.color || T.timetable}`,
              borderRadius: 10, padding: 12, marginBottom: 6,
              width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{g.title}</div>
                <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                  {g.start}–{g.end} · {g.days.length === 1 ? g.days[0] : `${g.days.length} days`}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
