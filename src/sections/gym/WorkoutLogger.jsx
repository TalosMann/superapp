/**
 * WorkoutLogger.jsx — Modal for creating/editing a workout session.
 *
 * Flow:
 *  - Pick workout type (from timetable Gym events + Custom)
 *  - Option to "Copy last session" — prefills exercises and sets from last
 *    workout of the same type
 *  - Add exercises from library (or Quick add inline)
 *  - For each exercise: tap to add sets. Each set has weight (or bodyweight) + reps.
 *  - "Same as previous set" auto-prefill for fast logging
 */

import { useState, useEffect, useRef } from 'react'
import { T, S } from '../../theme.js'
import { Modal, Toggle, Confirm } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { uid, todayStr, fmtDateLong } from '../../utils.js'
import { loadJSON, KEYS } from '../../storage.js'
import { lastWorkoutOfType } from './data.js'

export default function WorkoutLogger({ initial, sessions, exercises, onAddExercise, onSave, onDelete, onCancel }) {
  const isEdit = !!initial
  const [date, setDate] = useState(initial?.date || todayStr())
  const [type, setType] = useState(initial?.type || '')
  const [exerciseRows, setExerciseRows] = useState(initial?.exercises || [])
  const [notes, setNotes] = useState(initial?.notes || '')

  const [workoutTypes, setWorkoutTypes] = useState([])
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showCopyPrompt, setShowCopyPrompt] = useState(false)

  // Load workout types from timetable events (category=gym, deduped by title)
  useEffect(() => {
    if (isEdit) return  // don't auto-suggest on edit
    (async () => {
      const events = await loadJSON(KEYS.TT_EVENTS, [])
      const gymEventTitles = new Set()
      for (const e of events) {
        if (e.category === 'gym') gymEventTitles.add(e.title)
      }
      setWorkoutTypes([...gymEventTitles].sort())
    })()
  }, [isEdit])

  // When user picks a type, if we have a previous session of the same type and
  // this is a new session, prompt them to copy it.
  function pickType(t) {
    setType(t)
    if (!isEdit && exerciseRows.length === 0) {
      const last = lastWorkoutOfType(t, sessions)
      if (last && last.exercises?.length > 0) {
        setShowCopyPrompt(true)
      }
    }
  }

  function copyLastSession() {
    const last = lastWorkoutOfType(type, sessions)
    if (!last) return
    // Deep clone with fresh set IDs but same weight/reps as starting point
    const cloned = last.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      name: ex.name,
      isBodyweight: ex.isBodyweight,
      sets: (ex.sets || []).map(s => ({ weight: s.weight, reps: s.reps })),
    }))
    setExerciseRows(cloned)
    setShowCopyPrompt(false)
  }

  function addExerciseFromLibrary(ex) {
    setExerciseRows(prev => [...prev, {
      exerciseId: ex.id,
      name: ex.name,
      isBodyweight: ex.isBodyweight,
      sets: [{ weight: ex.isBodyweight ? 0 : (ex.defaultWeight || ''), reps: ex.defaultReps || '' }],
    }])
    setShowExercisePicker(false)
  }

  function addSet(exIdx) {
    setExerciseRows(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      const lastSet = ex.sets[ex.sets.length - 1] || { weight: '', reps: '' }
      return { ...ex, sets: [...ex.sets, { weight: lastSet.weight, reps: lastSet.reps }] }
    }))
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExerciseRows(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      return {
        ...ex,
        sets: ex.sets.map((s, j) => j === setIdx ? { ...s, [field]: value } : s),
      }
    }))
  }

  function removeSet(exIdx, setIdx) {
    setExerciseRows(prev => prev.map((ex, i) => {
      if (i !== exIdx) return ex
      const newSets = ex.sets.filter((_, j) => j !== setIdx)
      return { ...ex, sets: newSets }
    }))
  }

  function removeExercise(exIdx) {
    setExerciseRows(prev => prev.filter((_, i) => i !== exIdx))
  }

  function handleSave() {
    if (!type.trim()) return
    // Strip empty sets (no reps entered)
    const cleanExercises = exerciseRows
      .map(ex => ({
        ...ex,
        sets: ex.sets.filter(s => Number(s.reps) > 0),
      }))
      .filter(ex => ex.sets.length > 0)

    onSave({
      kind: 'workout',
      date,
      type: type.trim(),
      exercises: cleanExercises,
      notes: notes.trim(),
    })
  }

  const canSave = type.trim().length > 0

  return (
    <Modal title={isEdit ? 'Edit workout' : 'New workout'} onClose={onCancel} accent={T.gym}>
      {/* Date */}
      <label style={S.label}>Date</label>
      <input type="date" style={S.inputMono} value={date} onChange={e => setDate(e.target.value)} />

      {/* Type picker */}
      <label style={S.label}>Workout type</label>
      {!type ? (
        <>
          {workoutTypes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {workoutTypes.map(t => (
                <button key={t} onClick={() => pickType(t)} style={{
                  background: 'transparent', color: T.text2,
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '8px 14px', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>{t}</button>
              ))}
              <button onClick={() => pickType('Custom')} style={{
                background: 'transparent', color: T.text3,
                border: `1px dashed ${T.border}`, borderRadius: 8,
                padding: '8px 14px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>+ Custom</button>
            </div>
          ) : (
            <input style={S.input} placeholder="e.g. Push (Armour)"
              value={type} onChange={e => setType(e.target.value)} />
          )}
        </>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.bg3, border: `1px solid ${T.gym}`, borderRadius: 10,
          padding: 12,
        }}>
          <div style={{ flex: 1 }}>
            <input value={type} onChange={e => setType(e.target.value)} style={{
              width: '100%', background: 'transparent', border: 'none',
              color: T.text, fontSize: 15, fontWeight: 600,
              fontFamily: 'inherit', outline: 'none',
            }} />
          </div>
          <button onClick={() => { setType(''); setExerciseRows([]) }} style={{ ...S.iconBtn, color: T.text3 }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}

      {/* Exercises */}
      {type && (
        <>
          <label style={S.label}>Exercises</label>
          {exerciseRows.map((ex, i) => (
            <ExerciseRow
              key={i}
              ex={ex}
              onAddSet={() => addSet(i)}
              onUpdateSet={(setIdx, field, value) => updateSet(i, setIdx, field, value)}
              onRemoveSet={(setIdx) => removeSet(i, setIdx)}
              onRemoveExercise={() => removeExercise(i)}
            />
          ))}
          <button onClick={() => setShowExercisePicker(true)} style={{
            width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
            borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            marginTop: 6,
          }}>
            <Icon name="plus" size={14} stroke={3} /> Add exercise
          </button>

          <label style={S.label}>Notes (optional)</label>
          <textarea style={{ ...S.input, minHeight: 50, resize: 'vertical', fontFamily: 'inherit' }}
            value={notes} onChange={e => setNotes(e.target.value)} />

          <button onClick={handleSave} disabled={!canSave} style={{
            ...S.btnPrimary, marginTop: 18, background: T.gym, color: '#fff',
            opacity: canSave ? 1 : 0.5,
          }}>{isEdit ? 'Save changes' : 'Log workout'}</button>

          {isEdit && (
            <button onClick={() => setConfirmDel(true)} style={{
              width: '100%', background: 'transparent', border: `1px solid ${T.bad}`,
              borderRadius: 12, padding: 12, marginTop: 8, color: T.bad,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Delete session</button>
          )}
        </>
      )}

      {showExercisePicker && (
        <ExercisePicker
          exercises={exercises}
          onPick={addExerciseFromLibrary}
          onAddNew={(newEx) => {
            // Add to library AND add to current session
            onAddExercise(newEx).then(saved => addExerciseFromLibrary(saved))
          }}
          onCancel={() => setShowExercisePicker(false)}
        />
      )}

      {showCopyPrompt && (
        <Confirm
          title={`Copy last ${type} session?`}
          message={`Found a previous ${type} session. Prefill today's session with the same exercises and weights?`}
          onCancel={() => setShowCopyPrompt(false)}
          onConfirm={copyLastSession}
          danger={false}
        />
      )}

      {confirmDel && (
        <Confirm
          title="Delete session?"
          message="This will permanently remove this workout from your history."
          onCancel={() => setConfirmDel(false)}
          onConfirm={onDelete}
          danger
        />
      )}
    </Modal>
  )
}

// ── Exercise row inside the workout form ────────────────────────────────────

function ExerciseRow({ ex, onAddSet, onUpdateSet, onRemoveSet, onRemoveExercise }) {
  return (
    <div style={{
      background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10,
      padding: 10, marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{ex.name}</div>
          {ex.isBodyweight && (
            <div style={{ fontSize: 10, color: T.text3, marginTop: 1 }}>bodyweight</div>
          )}
        </div>
        <button onClick={onRemoveExercise} style={{ ...S.iconBtn, color: T.text4, padding: 4 }}>
          <Icon name="close" size={14} />
        </button>
      </div>

      {ex.sets.map((set, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        }}>
          <div style={{
            fontSize: 11, color: T.text4, width: 22, textAlign: 'center',
            fontWeight: 700,
          }}>{i + 1}</div>
          {!ex.isBodyweight && (
            <input type="number" inputMode="decimal" step="0.5"
              value={set.weight}
              onChange={e => onUpdateSet(i, 'weight', e.target.value)}
              placeholder="kg"
              style={{
                flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
                borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
                fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
              }} />
          )}
          <div style={{ fontSize: 11, color: T.text4 }}>×</div>
          <input type="number" inputMode="numeric"
            value={set.reps}
            onChange={e => onUpdateSet(i, 'reps', e.target.value)}
            placeholder="reps"
            style={{
              flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
              borderRadius: 6, padding: '6px 8px', color: T.text, fontSize: 13,
              fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center',
            }} />
          <button onClick={() => onRemoveSet(i)} style={{
            ...S.iconBtn, color: T.text4, padding: 2,
          }}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ))}

      <button onClick={onAddSet} style={{
        width: '100%', background: 'transparent', border: 'none',
        borderRadius: 6, padding: '6px 8px', marginTop: 4,
        color: T.gym, fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
      }}>+ Add set</button>
    </div>
  )
}

// ── Exercise library picker ─────────────────────────────────────────────────

function ExercisePicker({ exercises, onPick, onAddNew, onCancel }) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIsBodyweight, setNewIsBodyweight] = useState(false)

  function handleNew() {
    if (!newName.trim()) return
    onAddNew({
      name: newName.trim(),
      isBodyweight: newIsBodyweight,
    })
  }

  // If user types something not in library, offer "Add new"
  useEffect(() => {
    if (showNew) setNewName(search)
  }, [showNew])

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
  const exactMatch = exercises.some(e => e.name.toLowerCase() === search.toLowerCase())

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
            {showNew ? 'New exercise' : 'Pick exercise'}
          </div>
          <button style={S.iconBtn} onClick={onCancel}><Icon name="close" /></button>
        </div>

        {showNew ? (
          <div style={{ padding: '0 16px 20px' }}>
            <label style={S.label}>Name</label>
            <input style={S.input} value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Cable fly" autoFocus />
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 14, padding: '10px 12px', background: T.bg3, borderRadius: 10,
            }}>
              <div style={{ fontSize: 13, color: T.text2 }}>Bodyweight exercise</div>
              <Toggle on={newIsBodyweight} onChange={setNewIsBodyweight} color={T.gym} />
            </div>
            <button onClick={handleNew} disabled={!newName.trim()}
              style={{
                ...S.btnPrimary, marginTop: 14, background: T.gym, color: '#fff',
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
              {filtered.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: T.text3 }}>
                  No exercises match "{search}".
                </div>
              )}
              {filtered.map(ex => (
                <button key={ex.id} onClick={() => onPick(ex)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: T.bg3, border: `1px solid ${T.border}`,
                  borderRadius: 10, padding: 12, marginBottom: 6,
                  width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{ex.name}</div>
                    {ex.isBodyweight && (
                      <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>bodyweight</div>
                    )}
                  </div>
                </button>
              ))}
              {!exactMatch && search.trim() && (
                <button onClick={() => setShowNew(true)} style={{
                  width: '100%', background: 'transparent', border: `1px dashed ${T.gym}`,
                  borderRadius: 10, padding: 12, color: T.gym, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
                }}>+ Add "{search}" as new exercise</button>
              )}
              {!search.trim() && (
                <button onClick={() => setShowNew(true)} style={{
                  width: '100%', background: 'transparent', border: `1px dashed ${T.border}`,
                  borderRadius: 10, padding: 12, color: T.text3, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 6,
                }}>+ Quick add new exercise</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
