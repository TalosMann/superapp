/**
 * TempForm.jsx — Add a temporary (one-off) event.
 *
 * Single day, single occurrence. Computes absolute endDate + notifyAt
 * ISO strings from "next occurrence of <day> at <time>". If that occurrence
 * is in the past, wraps to next week.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Toggle } from '../../shared.jsx'
import { DAYS, DAY_SHORT, CATEGORIES, CATEGORY_BY_ID, NOTIFY_OPTIONS, suggestCategory } from './data.js'
import { todayStr } from '../../utils.js'

export default function TempForm({ defaultDay, onSave, onCancel }) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('other')
  const [color, setColor] = useState(CATEGORY_BY_ID.other.color)
  const [day, setDay] = useState(defaultDay || DAYS[0])
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [notes, setNotes] = useState('')
  const [notify, setNotify] = useState(true)
  const [notifyBefore, setNotifyBefore] = useState(10)

  useEffect(() => {
    if (category !== 'other') return
    const s = suggestCategory(title)
    if (s) { setCategory(s); setColor(CATEGORY_BY_ID[s].color) }
  }, [title, category])

  useEffect(() => {
    setColor(CATEGORY_BY_ID[category]?.color || T.text2)
  }, [category])

  function handleSave() {
    if (!title.trim() || start >= end) return
    const endDate = nextOccurrence(day, end)
    const notifyAt = notify ? subtractMinutes(nextOccurrence(day, start), notifyBefore) : null
    onSave({
      title: title.trim(), category, color, day, start, end,
      notes: notes.trim(), notify, notifyBefore,
      endDate: endDate.toISOString(),
      notifyAt: notifyAt ? notifyAt.toISOString() : null,
    })
  }

  const valid = title.trim().length > 0 && start < end

  return (
    <Modal title="One-off event" onClose={onCancel} accent={T.ok}>
      <div style={{
        padding: '10px 12px', background: T.bg3, borderRadius: 10,
        fontSize: 12, color: T.text2, marginTop: 6, marginBottom: 12, lineHeight: 1.4,
      }}>
        One-off events don't repeat. They auto-disappear after the time has passed.
      </div>

      <label style={S.label}>Title</label>
      <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} autoFocus />

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

      <label style={S.label}>Day</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {DAYS.map(d => (
          <button key={d} onClick={() => setDay(d)} style={{
            flex: 1, minWidth: 38,
            background: day === d ? T.timetable : 'transparent',
            color: day === d ? '#0a0e15' : T.text2,
            border: `1px solid ${day === d ? T.timetable : T.border}`,
            borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{DAY_SHORT[d]}</button>
        ))}
      </div>

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

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginTop: 14, padding: '10px 12px', background: T.bg3, borderRadius: 10,
      }}>
        <div style={{ fontSize: 13, color: T.text2 }}>Notification</div>
        <Toggle on={notify} onChange={setNotify} color={T.timetable} />
      </div>
      {notify && (
        <select value={notifyBefore} onChange={e => setNotifyBefore(Number(e.target.value))}
          style={{ ...S.input, appearance: 'none', cursor: 'pointer', marginTop: 8 }}>
          {NOTIFY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      <label style={S.label}>Notes (optional)</label>
      <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
        value={notes} onChange={e => setNotes(e.target.value)} />

      <button onClick={handleSave} disabled={!valid} style={{
        ...S.btnPrimary, marginTop: 18, background: T.ok, color: '#0a0e15',
        opacity: valid ? 1 : 0.5,
      }}>
        Add one-off event
      </button>
    </Modal>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nextOccurrence(dayName, time) {
  const dayIdx = DAYS.indexOf(dayName) // 0 = Mon
  const now = new Date()
  // JS Date: 0=Sun. Convert: Mon=0, Sun=6
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1
  let diff = dayIdx - todayIdx
  if (diff < 0) diff += 7
  const [h, m] = time.split(':').map(Number)
  const d = new Date(now)
  d.setDate(d.getDate() + diff)
  d.setHours(h, m, 0, 0)
  if (d <= now) d.setDate(d.getDate() + 7)
  return d
}

function subtractMinutes(date, mins) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - mins)
  return d
}
