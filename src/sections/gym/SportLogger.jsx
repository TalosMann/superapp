/**
 * SportLogger.jsx — Modal for creating/editing a sport session.
 *
 * Flow:
 *  - Pick an activity (from library), or add a new activity inline
 *  - Form fields adapt to the activity's mode:
 *      duration: minutes
 *      distance: distance + unit + minutes (pace derived)
 *      sets:     list of sets with reps / seconds / distance per set
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Confirm } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { todayStr } from '../../utils.js'
import { SPORT_MODES, DISTANCE_UNITS, sportSessionStats } from './data.js'

export default function SportLogger({ initial, activities, onAddActivity, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const [date, setDate] = useState(initial?.date || todayStr())
  const [activity, setActivity] = useState(
    initial ? activities.find(a => a.id === initial.activityId) : null
  )
  const [showActivityPicker, setShowActivityPicker] = useState(!initial)

  // Mode-specific state
  const [minutes, setMinutes] = useState(initial?.minutes || '')
  const [distance, setDistance] = useState(initial?.distance || '')
  const [unit, setUnit] = useState(initial?.unit || 'km')
  const [sets, setSets] = useState(initial?.sets || [{ reps: '', seconds: '', distance: '' }])
  const [notes, setNotes] = useState(initial?.notes || '')

  const [confirmDel, setConfirmDel] = useState(false)

  // When picking an activity, reset mode-specific state appropriately
  function pickActivity(a) {
    setActivity(a)
    if (a.mode === 'distance') {
      setUnit(a.defaultUnit || 'km')
    } else if (a.mode === 'sets') {
      setUnit(a.defaultUnit || null)
      // For sets mode, prefill one empty set if there isn't one
      if (sets.length === 0) setSets([{ reps: '', seconds: '', distance: '' }])
    }
    setShowActivityPicker(false)
  }

  function addSet() {
    const last = sets[sets.length - 1] || { reps: '', seconds: '', distance: '' }
    setSets([...sets, { reps: last.reps, seconds: last.seconds, distance: last.distance }])
  }

  function updateSet(i, field, value) {
    setSets(sets.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }

  function removeSet(i) {
    setSets(sets.filter((_, idx) => idx !== i))
  }

  function handleSave() {
    if (!activity) return
    const session = {
      kind: 'sport',
      date,
      activityId: activity.id,
      name: activity.name,
      mode: activity.mode,
      notes: notes.trim(),
    }
    if (activity.mode === 'duration') {
      session.minutes = Number(minutes) || 0
    } else if (activity.mode === 'distance') {
      session.distance = Number(distance) || 0
      session.unit = unit
      session.minutes = Number(minutes) || 0
    } else if (activity.mode === 'sets') {
      session.sets = sets
        .map(s => ({
          reps: Number(s.reps) || 0,
          seconds: Number(s.seconds) || 0,
          distance: Number(s.distance) || 0,
        }))
        .filter(s => s.reps > 0 || s.seconds > 0 || s.distance > 0)
      session.unit = unit
    }
    onSave(session)
  }

  // Validate
  const canSave = activity && (
    (activity.mode === 'duration' && Number(minutes) > 0) ||
    (activity.mode === 'distance' && Number(distance) > 0) ||
    (activity.mode === 'sets' && sets.some(s => Number(s.reps) > 0 || Number(s.seconds) > 0 || Number(s.distance) > 0))
  )

  const previewStats = activity ? sportSessionStats({
    mode: activity.mode, minutes, distance, unit, sets,
  }) : null

  return (
    <Modal title={isEdit ? 'Edit session' : 'New sport session'} onClose={onCancel} accent={T.gym}>
      <label style={S.label}>Date</label>
      <input type="date" style={S.inputMono} value={date} onChange={e => setDate(e.target.value)} />

      <label style={S.label}>Activity</label>
      {activity ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: T.bg3, border: `1px solid ${activity.color || T.gym}`,
          borderLeft: `3px solid ${activity.color || T.gym}`,
          borderRadius: 10, padding: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{activity.name}</div>
            <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
              {SPORT_MODES.find(m => m.id === activity.mode)?.label}
            </div>
          </div>
          {!isEdit && (
            <button onClick={() => { setActivity(null); setShowActivityPicker(true) }}
              style={{ ...S.iconBtn, color: T.text3 }}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => setShowActivityPicker(true)} style={{
          width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
          borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Pick an activity</button>
      )}

      {/* Mode-specific fields */}
      {activity?.mode === 'duration' && (
        <>
          <label style={S.label}>Duration (minutes)</label>
          <input type="number" inputMode="numeric" style={S.inputMono}
            value={minutes} onChange={e => setMinutes(e.target.value)}
            placeholder="0" autoFocus />
        </>
      )}

      {activity?.mode === 'distance' && (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}>
              <label style={S.label}>Distance</label>
              <input type="number" inputMode="decimal" step="0.01" style={S.inputMono}
                value={distance} onChange={e => setDistance(e.target.value)}
                placeholder="0" autoFocus />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Unit</label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                style={{ ...S.input, appearance: 'none', cursor: 'pointer' }}>
                {DISTANCE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <label style={S.label}>Duration (minutes)</label>
          <input type="number" inputMode="numeric" style={S.inputMono}
            value={minutes} onChange={e => setMinutes(e.target.value)}
            placeholder="0" />
          {previewStats?.pace && (
            <div style={{
              marginTop: 8, padding: '8px 12px', background: T.bg3, borderRadius: 8,
              fontSize: 12, color: T.text2, display: 'flex', justifyContent: 'space-between',
            }}>
              <span>Pace</span>
              <span className="mono">{previewStats.pace.toFixed(2)} min/{unit}</span>
            </div>
          )}
        </>
      )}

      {activity?.mode === 'sets' && (
        <>
          <label style={S.label}>Sets</label>
          <div style={{ marginBottom: 8 }}>
            {sets.map((set, i) => (
              <div key={i} style={{
                background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8,
                padding: 8, marginBottom: 6,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6,
                }}>
                  <div style={{ fontSize: 11, color: T.text4, fontWeight: 700 }}>Set {i + 1}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => removeSet(i)} style={{
                    ...S.iconBtn, color: T.text4, padding: 2,
                  }}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <SetFieldInput label="Reps" value={set.reps}
                    onChange={v => updateSet(i, 'reps', v)} />
                  <SetFieldInput label="Seconds" value={set.seconds}
                    onChange={v => updateSet(i, 'seconds', v)} />
                  <SetFieldInput label={`Dist${unit ? ` (${unit})` : ''}`} value={set.distance}
                    onChange={v => updateSet(i, 'distance', v)} />
                </div>
              </div>
            ))}
            <button onClick={addSet} style={{
              width: '100%', background: 'transparent', border: 'none',
              padding: '6px 8px', color: T.gym, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>+ Add set</button>
          </div>
        </>
      )}

      {activity && (
        <>
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
        </>
      )}

      {showActivityPicker && (
        <ActivityPicker
          activities={activities}
          onPick={pickActivity}
          onAddNew={(newAct) => {
            onAddActivity(newAct).then(saved => pickActivity(saved))
          }}
          onCancel={() => {
            setShowActivityPicker(false)
            if (!activity) onCancel()  // cancel whole modal if no activity selected
          }}
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
                    {m.id === 'sets' && 'Sets/reps drill — e.g. sprints, plyometrics'}
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
