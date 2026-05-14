/**
 * EventForm.jsx — Unified add/edit form for permanent events.
 *
 * Add mode: pick one or more days; saving creates one event per day, all
 * sharing a fresh groupId. Form state has a `days` array; the parent splits
 * it into N events.
 *
 * Edit mode: the parent enriches the event with a `days` array (all siblings
 * by groupId) and the form lets you change days. Saving in the parent wipes
 * all siblings by groupId and recreates them.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Toggle } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { DAYS, DAY_SHORT, CATEGORIES, CATEGORY_BY_ID, NOTIFY_OPTIONS, DAY_PRESETS, suggestCategory } from './data.js'

export default function EventForm({ isEdit, initial, onSave, onDelete, onCancel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [category, setCategory] = useState(initial?.category || 'other')
  const [color, setColor] = useState(initial?.color || CATEGORY_BY_ID.other.color)
  const [days, setDays] = useState(initial?.days || [initial?.day || 'Monday'])
  const [start, setStart] = useState(initial?.start || '09:00')
  const [end, setEnd] = useState(initial?.end || '10:00')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [notify, setNotify] = useState(initial?.notify ?? true)
  const [notifyBefore, setNotifyBefore] = useState(initial?.notifyBefore ?? 10)
  const [colorOverridden, setColorOverridden] = useState(false)

  // Smart category suggestion: only in add mode, only while category is still
  // the default 'other'. Once user touches the category dropdown, stop suggesting.
  useEffect(() => {
    if (isEdit) return
    if (category !== 'other') return
    const suggested = suggestCategory(title)
    if (suggested) {
      setCategory(suggested)
      if (!colorOverridden) setColor(CATEGORY_BY_ID[suggested].color)
    }
  }, [title, isEdit, category, colorOverridden])

  // When category changes, sync color (unless user has overridden it manually).
  useEffect(() => {
    if (!colorOverridden) {
      setColor(CATEGORY_BY_ID[category]?.color || T.text2)
    }
  }, [category, colorOverridden])

  function toggleDay(d) {
    setDays(prev => {
      if (prev.includes(d)) {
        // enforce min of 1 day
        return prev.length > 1 ? prev.filter(x => x !== d) : prev
      }
      return [...prev, d]
    })
  }

  function applyPreset(presetDays) {
    setDays([...presetDays])
  }

  function handleSave() {
    if (!title.trim()) return
    if (start >= end) return
    onSave({
      title: title.trim(),
      category,
      color,
      days,
      start,
      end,
      notes: notes.trim(),
      notify,
      notifyBefore,
    })
  }

  const valid = title.trim().length > 0 && start < end && days.length > 0

  return (
    <Modal
      title={isEdit ? (initial?.days?.length > 1 ? `Edit (${initial.days.length}× weekly)` : 'Edit event') : 'New event'}
      onClose={onCancel}
      accent={T.timetable}
    >
      {/* Title */}
      <label style={S.label}>Title</label>
      <input style={S.input} value={title} onChange={e => setTitle(e.target.value)}
        placeholder="e.g. Push (Armour)" autoFocus={!isEdit} />

      {/* Category */}
      <label style={S.label}>Category</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => setCategory(c.id)} style={{
            background: category === c.id ? c.color : 'transparent',
            color: category === c.id ? '#0a0e15' : T.text2,
            border: `1px solid ${category === c.id ? c.color : T.border}`,
            borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{c.label}</button>
        ))}
      </div>

      {/* Days */}
      <label style={S.label}>{isEdit ? 'Repeats on' : 'Days'}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {DAYS.map(d => (
          <button key={d} onClick={() => toggleDay(d)} style={{
            flex: 1, minWidth: 38,
            background: days.includes(d) ? T.timetable : 'transparent',
            color: days.includes(d) ? '#0a0e15' : T.text2,
            border: `1px solid ${days.includes(d) ? T.timetable : T.border}`,
            borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{DAY_SHORT[d]}</button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {DAY_PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.days)} style={{
            background: 'transparent', color: T.text3,
            border: `1px solid ${T.border}`, borderRadius: 6,
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{p.label}</button>
        ))}
      </div>
      {isEdit && initial?.days?.length > 1 && (
        <div style={{
          marginTop: 10, padding: 10, background: T.bg3, borderRadius: 8,
          fontSize: 12, color: T.text2, lineHeight: 1.4,
        }}>
          Editing affects all {initial.days.length} occurrences of this event in the week.
        </div>
      )}

      {/* Time */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Start</label>
          <input type="time" style={S.inputMono} value={start} onChange={e => setStart(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>End</label>
          <input type="time" style={S.inputMono} value={end} onChange={e => setEnd(e.target.value)} />
        </div>
      </div>
      {start >= end && (
        <div style={{ fontSize: 11, color: T.bad, marginTop: 6 }}>End time must be after start time.</div>
      )}

      {/* Notify */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, padding: '10px 12px', background: T.bg3, borderRadius: 10,
      }}>
        <div style={{ fontSize: 13, color: T.text2 }}>Notification</div>
        <Toggle on={notify} onChange={setNotify} color={T.timetable} />
      </div>
      {notify && (
        <div style={{ marginTop: 8 }}>
          <select value={notifyBefore} onChange={e => setNotifyBefore(Number(e.target.value))}
            style={{ ...S.input, appearance: 'none', cursor: 'pointer' }}>
            {NOTIFY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {/* Color override (collapsed by default; let's show it always but compact) */}
      <label style={S.label}>Color</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIES.map(c => (
          <button key={c.id} onClick={() => { setColor(c.color); setColorOverridden(true) }}
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: c.color,
              border: color === c.color ? `2px solid ${T.text}` : `2px solid transparent`,
              cursor: 'pointer',
            }}
            title={c.label}
          />
        ))}
      </div>

      {/* Notes */}
      <label style={S.label}>Notes (optional)</label>
      <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
        value={notes} onChange={e => setNotes(e.target.value)} placeholder="" />

      {/* Save */}
      <button onClick={handleSave} disabled={!valid} style={{
        ...S.btnPrimary, marginTop: 18, background: T.timetable, color: '#0a0e15',
        opacity: valid ? 1 : 0.5,
      }}>
        {isEdit ? 'Save changes' : `Add to ${days.length === 1 ? days[0] : `${days.length} days`}`}
      </button>

      {/* Delete (edit mode only) */}
      {isEdit && (
        <button onClick={onDelete} style={{
          width: '100%', background: 'transparent', border: `1px solid ${T.bad}`,
          borderRadius: 12, padding: 12, marginTop: 8, color: T.bad,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Delete {initial?.days?.length > 1 ? `all ${initial.days.length} occurrences` : 'this event'}
        </button>
      )}
    </Modal>
  )
}
