/**
 * SportLogger.jsx — Modal for creating/editing a sport session.
 *
 * A sport session mirrors a workout: it has a name (e.g. "Football training")
 * and contains one or more ACTIVITY ENTRIES, each measured by its own mode:
 *   duration: minutes
 *   distance: distance + unit + minutes (pace derived)
 *   sets:     list of sets with reps / seconds / distance per set
 *
 * Flow:
 *  - Name the session (optional — defaults to the lone activity's name, or
 *    "Sport session" when several are logged)
 *  - Add activities from the library (or create one inline); each gets its own
 *    inline inputs based on its mode
 *  - Optionally "Copy last <name>" to prefill from the previous session of the
 *    same name
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Confirm } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { todayStr } from '../../utils.js'
import {
  SPORT_MODES, DISTANCE_UNITS, sportSessionStats,
  sportActivities, lastSportSession,
} from './data.js'

// Build a fresh activity row (with empty inputs) from a library activity.
function rowFromActivity(a) {
  const row = {
    activityId: a.id,
    name: a.name,
    mode: a.mode,
    color: a.color,
  }
  if (a.mode === 'duration') {
    row.minutes = ''
  } else if (a.mode === 'distance') {
    row.distance = ''
    row.minutes = ''
    row.unit = a.defaultUnit || 'km'
  } else if (a.mode === 'setsreps') {
    row.setCount = ''
    row.repsPerSet = ''
  } else if (a.mode === 'sets') {
    row.sets = [{ reps: '', seconds: '', distance: '' }]
    row.unit = a.defaultUnit || null
  }
  return row
}

// Normalise an existing session's saved entries into editable rows.
function rowsFromSession(session, activities) {
  return sportActivities(session).map(e => {
    const lib = activities.find(a => a.id === e.activityId)
    const row = {
      activityId: e.activityId,
      name: e.name,
      mode: e.mode,
      color: lib?.color,
    }
    if (e.mode === 'duration') {
      row.minutes = e.minutes ?? ''
    } else if (e.mode === 'distance') {
      row.distance = e.distance ?? ''
      row.minutes = e.minutes ?? ''
      row.unit = e.unit || lib?.defaultUnit || 'km'
    } else if (e.mode === 'setsreps') {
      row.setCount = e.setCount ?? ''
      row.repsPerSet = e.repsPerSet ?? ''
    } else if (e.mode === 'sets') {
      row.sets = (e.sets && e.sets.length)
        ? e.sets.map(s => ({ reps: s.reps ?? '', seconds: s.seconds ?? '', distance: s.distance ?? '' }))
        : [{ reps: '', seconds: '', distance: '' }]
      row.unit = e.unit || lib?.defaultUnit || null
    }
    return row
  })
}

function rowHasData(r) {
  if (r.mode === 'duration') return Number(r.minutes) > 0
  if (r.mode === 'distance') return Number(r.distance) > 0 || Number(r.minutes) > 0
  if (r.mode === 'setsreps') return Number(r.setCount) > 0 && Number(r.repsPerSet) > 0
  if (r.mode === 'sets') {
    return (r.sets || []).some(s =>
      Number(s.reps) > 0 || Number(s.seconds) > 0 || Number(s.distance) > 0)
  }
  return false
}

export default function SportLogger({ initial, sessions = [], activities, onAddActivity, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const [date, setDate] = useState(initial?.date || todayStr())
  const [name, setName] = useState(initial?.name || '')
  const [rows, setRows] = useState(initial ? rowsFromSession(initial, activities) : [])
  const [notes, setNotes] = useState(initial?.notes || '')

  const [showActivityPicker, setShowActivityPicker] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  // Offer to copy the previous session of the same name, once, when the name
  // matches a prior session and nothing's been added yet.
  const prior = (!isEdit && name.trim() && rows.length === 0)
    ? lastSportSession(name.trim(), sessions)
    : null

  function copyLast() {
    if (!prior) return
    setRows(rowsFromSession(prior, activities))
  }

  function addActivityRow(a) {
    setRows(prev => [...prev, rowFromActivity(a)])
    setShowActivityPicker(false)
  }

  function removeRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateRow(i, field, value) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addSet(i) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      const last = r.sets[r.sets.length - 1] || { reps: '', seconds: '', distance: '' }
      return { ...r, sets: [...r.sets, { reps: last.reps, seconds: last.seconds, distance: last.distance }] }
    }))
  }

  function updateSet(i, setIdx, field, value) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      return { ...r, sets: r.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s) }
    }))
  }

  function removeSet(i, setIdx) {
    setRows(prev => prev.map((r, idx) => {
      if (idx !== i) return r
      return { ...r, sets: r.sets.filter((_, j) => j !== setIdx) }
    }))
  }

  function handleSave() {
    const activitiesOut = rows
      .map(r => {
        const base = { activityId: r.activityId, name: r.name, mode: r.mode }
        if (r.mode === 'duration') {
          return { ...base, minutes: Number(r.minutes) || 0 }
        }
        if (r.mode === 'distance') {
          return { ...base, distance: Number(r.distance) || 0, unit: r.unit, minutes: Number(r.minutes) || 0 }
        }
        if (r.mode === 'setsreps') {
          return { ...base, setCount: Number(r.setCount) || 0, repsPerSet: Number(r.repsPerSet) || 0 }
        }
        if (r.mode === 'sets') {
          return {
            ...base,
            unit: r.unit || null,
            sets: (r.sets || [])
              .map(s => ({ reps: Number(s.reps) || 0, seconds: Number(s.seconds) || 0, distance: Number(s.distance) || 0 }))
              .filter(s => s.reps > 0 || s.seconds > 0 || s.distance > 0),
          }
        }
        return base
      })
      .filter((r, idx) => rowHasData(rows[idx]))

    if (activitiesOut.length === 0) return

    const sessionName = name.trim() ||
      (activitiesOut.length === 1 ? activitiesOut[0].name : 'Sport session')

    onSave({
      kind: 'sport',
      date,
      name: sessionName,
      activities: activitiesOut,
      notes: notes.trim(),
    })
  }

  const canSave = rows.some(rowHasData)

  return (
    <Modal title={isEdit ? 'Edit session' : 'New sport session'} onClose={onCancel} accent={T.gym}>
      <label style={S.label}>Date</label>
      <input type="date" style={S.inputMono} value={date} onChange={e => setDate(e.target.value)} />

      <label style={S.label}>Session name</label>
      <input style={S.input} value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Football training" />

      {prior && (
        <button onClick={copyLast} style={{
          width: '100%', background: 'transparent', border: `1px dashed ${T.gym}`,
          borderRadius: 10, padding: 10, marginTop: 8, color: T.gym,
          fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Copy last "{name.trim()}" session</button>
      )}

      <label style={S.label}>Activities</label>
      {rows.map((row, i) => (
        <ActivityRow
          key={i}
          row={row}
          onUpdate={(field, value) => updateRow(i, field, value)}
          onRemove={() => removeRow(i)}
          onAddSet={() => addSet(i)}
          onUpdateSet={(setIdx, field, value) => updateSet(i, setIdx, field, value)}
          onRemoveSet={(setIdx) => removeSet(i, setIdx)}
        />
      ))}

      <button onClick={() => setShowActivityPicker(true)} style={{
        width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
        borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        marginTop: 6,
      }}>
        <Icon name="plus" size={14} stroke={3} /> Add activity
      </button>

      <label style={S.label}>Notes (optional)</label>
      <textarea style={{ ...S.input, minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
        value={notes} onChange={e => setNotes(e.target.value)} />

      <button onClick={handleSave} disabled={!canSave} style={{
        ...S.btnPrimary, marginTop: 18, background: T.gym, color: '#fff',
        opacity: canSave ? 1 : 0.5,
      }}>{isEdit ? 'Save changes' : 'Log session'}</button>

      {isEdit && (
        <button onClick={() => setConfirmDel(true)} style={{
          width: '100%', background: 'transparent', border: `1px solid ${T.bad}`,
          borderRadius: 12, padding: 12, marginTop: 8, color: T.bad,
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>Delete session</button>
      )}

      {showActivityPicker && (
        <ActivityPicker
          activities={activities}
          onPick={addActivityRow}
          onAddNew={(newAct) => {
            onAddActivity(newAct).then(saved => addActivityRow(saved))
          }}
          onCancel={() => setShowActivityPicker(false)}
        />
      )}

      {confirmDel && (
        <Confirm
          title="Delete session?"
          message="This will permanently remove this sport session from your history."
          onCancel={() => setConfirmDel(false)}
          onConfirm={onDelete}
          danger
        />
      )}
    </Modal>
  )
}

// ── One activity entry inside the session form ──────────────────────────────

function ActivityRow({ row, onUpdate, onRemove, onAddSet, onUpdateSet, onRemoveSet }) {
  const accent = row.color || T.gym
  const previewPace = row.mode === 'distance'
    ? sportSessionStats({ mode: 'distance', distance: row.distance, minutes: row.minutes, unit: row.unit }).pace
    : null

  return (
    <div style={{
      background: T.bg3, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: 10,
      padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{row.name}</div>
          <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>
            {SPORT_MODES.find(m => m.id === row.mode)?.label}
          </div>
        </div>
        <button onClick={onRemove} style={{ ...S.iconBtn, color: T.text4, padding: 4 }}>
          <Icon name="close" size={14} />
        </button>
      </div>

      {row.mode === 'duration' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" inputMode="numeric"
            value={row.minutes} onChange={e => onUpdate('minutes', e.target.value)}
            placeholder="0"
            style={{
              flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
              fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
            }} />
          <div style={{ fontSize: 12, color: T.text3 }}>minutes</div>
        </div>
      )}

      {row.mode === 'distance' && (
        <>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ flex: 2 }}>
              <div style={{ fontSize: 9, color: T.text4, marginBottom: 2 }}>Distance</div>
              <input type="number" inputMode="decimal" step="0.01"
                value={row.distance} onChange={e => onUpdate('distance', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
                  fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
                  boxSizing: 'border-box',
                }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: T.text4, marginBottom: 2 }}>Unit</div>
              <select value={row.unit} onChange={e => onUpdate('unit', e.target.value)}
                style={{
                  width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', appearance: 'none', cursor: 'pointer',
                  boxSizing: 'border-box',
                }}>
                {DISTANCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ flex: 1.4 }}>
              <div style={{ fontSize: 9, color: T.text4, marginBottom: 2 }}>Minutes</div>
              <input type="number" inputMode="numeric"
                value={row.minutes} onChange={e => onUpdate('minutes', e.target.value)}
                placeholder="0"
                style={{
                  width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
                  borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
                  fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
                  boxSizing: 'border-box',
                }} />
            </div>
          </div>
          {previewPace && (
            <div style={{
              marginTop: 8, padding: '6px 10px', background: T.bg2, borderRadius: 8,
              fontSize: 12, color: T.text2, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Pace</span>
              <span className="mono">{previewPace.toFixed(2)} min/{row.unit}</span>
            </div>
          )}
        </>
      )}

      {row.mode === 'setsreps' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="number" inputMode="numeric"
            value={row.setCount} onChange={e => onUpdate('setCount', e.target.value)}
            placeholder="0"
            style={{
              flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
              fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
            }} />
          <div style={{ fontSize: 12, color: T.text3 }}>sets ×</div>
          <input type="number" inputMode="numeric"
            value={row.repsPerSet} onChange={e => onUpdate('repsPerSet', e.target.value)}
            placeholder="0"
            style={{
              flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
              fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
            }} />
          <div style={{ fontSize: 12, color: T.text3 }}>reps</div>
        </div>
      )}

      {row.mode === 'sets' && (
        <>
          {(row.sets || []).map((set, j) => (
            <div key={j} style={{
              display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6,
            }}>
              <div style={{ fontSize: 11, color: T.text4, width: 18, fontWeight: 700, paddingBottom: 6 }}>{j + 1}</div>
              <SetFieldInput label="Reps" value={set.reps}
                onChange={v => onUpdateSet(j, 'reps', v)} />
              <SetFieldInput label="Seconds" value={set.seconds}
                onChange={v => onUpdateSet(j, 'seconds', v)} />
              <SetFieldInput label={`Dist${row.unit ? ` (${row.unit})` : ''}`} value={set.distance}
                onChange={v => onUpdateSet(j, 'distance', v)} />
              <button onClick={() => onRemoveSet(j)} style={{ ...S.iconBtn, color: T.text4, padding: 2, paddingBottom: 6 }}>
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
          <button onClick={onAddSet} style={{
            width: '100%', background: 'transparent', border: 'none',
            padding: '6px 8px', marginTop: 2, color: accent, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>+ Add set</button>
        </>
      )}
    </div>
  )
}

function SetFieldInput({ label, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 9, color: T.text4, marginBottom: 2 }}>{label}</div>
      <input type="number" inputMode="decimal"
        value={value} onChange={e => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
          fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
          boxSizing: 'border-box',
        }} />
    </div>
  )
}

// ── Activity picker ─────────────────────────────────────────────────────────

function ActivityPicker({ activities, onPick, onAddNew, onCancel }) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMode, setNewMode] = useState('duration')
  const [newUnit, setNewUnit] = useState('km')

  useEffect(() => {
    if (showNew) setNewName(search)
  }, [showNew])

  function handleNew() {
    if (!newName.trim()) return
    onAddNew({
      name: newName.trim(),
      mode: newMode,
      defaultUnit: newMode === 'distance' ? newUnit : null,
      color: '#fb923c',
    })
  }

  const filtered = activities.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
  const exactMatch = activities.some(a => a.name.toLowerCase() === search.toLowerCase())

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg2, borderTop: `2px solid ${T.gym}`,
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 16px 8px', gap: 8 }}>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: T.text }}>
            {showNew ? 'New activity' : 'Pick activity'}
          </div>
          <button style={S.iconBtn} onClick={onCancel}><Icon name="close" /></button>
        </div>

        {showNew ? (
          <div style={{ padding: '0 16px 20px' }}>
            <label style={S.label}>Name</label>
            <input style={S.input} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Tennis" autoFocus />
            <label style={S.label}>How do you measure this?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SPORT_MODES.map(m => (
                <button key={m.id} onClick={() => setNewMode(m.id)} style={{
                  background: newMode === m.id ? T.bg3 : 'transparent',
                  color: newMode === m.id ? T.text : T.text2,
                  border: `1px solid ${newMode === m.id ? T.gym : T.border}`,
                  borderRadius: 10, padding: '10px 12px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{ fontWeight: 700 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                    {m.id === 'duration' && 'Just minutes — e.g. dodgeball, juggling'}
                    {m.id === 'distance' && 'Distance + time — e.g. running, swimming laps'}
                    {m.id === 'setsreps' && 'Just sets and reps — e.g. 3 sets of 5 figure 8s'}
                    {m.id === 'sets' && 'Per-set reps / time / distance — e.g. sprints'}
                  </div>
                </button>
              ))}
            </div>
            {newMode === 'distance' && (
              <>
                <label style={S.label}>Default unit</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DISTANCE_UNITS.map(u => (
                    <button key={u} onClick={() => setNewUnit(u)} style={{
                      flex: 1,
                      background: newUnit === u ? T.gym : 'transparent',
                      color: newUnit === u ? '#fff' : T.text2,
                      border: `1px solid ${newUnit === u ? T.gym : T.border}`,
                      borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}>{u}</button>
                  ))}
                </div>
              </>
            )}
            <button onClick={handleNew} disabled={!newName.trim()}
              style={{
                ...S.btnPrimary, marginTop: 18, background: T.gym, color: '#fff',
                opacity: newName.trim() ? 1 : 0.5,
              }}>Add and use</button>
            <button onClick={() => setShowNew(false)} style={{
              width: '100%', background: 'transparent', border: 'none',
              padding: 12, marginTop: 4, color: T.text3, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>Back to library</button>
          </div>
        ) : (
          <>
            <div style={{ padding: '0 16px 8px' }}>
              <input style={S.input} value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search..." autoFocus />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 20px' }}>
              {filtered.length === 0 && search.trim() === '' && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3 }}>
                  No activities in your library yet.
                </div>
              )}
              {filtered.map(a => (
                <button key={a.id} onClick={() => onPick(a)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: T.bg3, border: `1px solid ${T.border}`,
                  borderLeft: `3px solid ${a.color || T.gym}`,
                  borderRadius: 10, padding: 12, marginBottom: 6,
                  width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                      {SPORT_MODES.find(m => m.id === a.mode)?.label}
                      {a.defaultUnit && ` · ${a.defaultUnit}`}
                    </div>
                  </div>
                </button>
              ))}
              {search.trim() && !exactMatch && (
                <button onClick={() => setShowNew(true)} style={{
                  width: '100%', background: 'transparent', border: `1px dashed ${T.gym}`,
                  borderRadius: 10, padding: 12, color: T.gym, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
                }}>+ Add "{search}" as new activity</button>
              )}
              {!search.trim() && (
                <button onClick={() => setShowNew(true)} style={{
                  width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
                  borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
                }}>+ Quick add new activity</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
