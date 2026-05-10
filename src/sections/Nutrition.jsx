/**
 * Nutrition.jsx — Daily food logging + body weight tracking.
 *
 * Data model:
 *   logs:    { [YYYY-MM-DD]: { breakfast: [Item], lunch: [Item], dinner: [Item], snacks: [Item], dayType: 'rest'|'normal'|'active' } }
 *   weights: { [YYYY-MM-DD]: number }  // body weight in kg
 *   targets: { rest: {cal,protein}, normal: {cal,protein}, active: {cal,protein} }
 *   foods:   [Food]   // user-built food library for quick re-add
 *
 *   Item = { id, name, grams, cal, protein }
 *   Food = { id, name, defaultGrams, calPer100g, proteinPer100g }
 */

import { useState, useEffect, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts'
import { T, S } from '../theme.js'
import { Modal, Toggle, ProgressBar, EmptyState, Stat, Confirm } from '../shared.jsx'
import Icon from '../Icon.jsx'
import { uid, todayStr, fmtDate, fmtDateLong, lastNDays, fmtNum, pct } from '../utils.js'
import { loadJSON, saveJSON, KEYS } from '../storage.js'

const MEAL_SLOTS = [
  { id: 'breakfast', label: 'Breakfast', icon: 'cup' },
  { id: 'lunch',     label: 'Lunch',     icon: 'fork' },
  { id: 'dinner',    label: 'Dinner',    icon: 'fork' },
  { id: 'snacks',    label: 'Snacks',    icon: 'flame' },
]

const DAY_TYPES = [
  { id: 'rest',   label: 'Rest',   color: T.info },
  { id: 'normal', label: 'Normal', color: T.nutrition },
  { id: 'active', label: 'Active', color: T.bad },
]

const DEFAULT_TARGETS = {
  rest:   { cal: 1900, protein: 185 },
  normal: { cal: 2100, protein: 200 },
  active: { cal: 2300, protein: 200 },
}

function emptyDay(dayType = 'normal') {
  return { breakfast: [], lunch: [], dinner: [], snacks: [], dayType }
}

function dayTotals(day) {
  if (!day) return { cal: 0, protein: 0, grams: 0 }
  let cal = 0, protein = 0, grams = 0
  for (const slot of ['breakfast', 'lunch', 'dinner', 'snacks']) {
    for (const it of (day[slot] || [])) {
      cal += Number(it.cal) || 0
      protein += Number(it.protein) || 0
      grams += Number(it.grams) || 0
    }
  }
  return { cal: Math.round(cal), protein: Math.round(protein * 10) / 10, grams: Math.round(grams) }
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Nutrition() {
  const [logs, setLogs] = useState({})
  const [weights, setWeights] = useState({})
  const [targets, setTargets] = useState(DEFAULT_TARGETS)
  const [foods, setFoods] = useState([])
  const [date, setDate] = useState(todayStr())
  const [view, setView] = useState('day') // 'day' | 'trend' | 'foods' | 'settings'
  const [modal, setModal] = useState(null) // { type, slot? } | { type:'editFood', food } | { type:'weight' }
  const [loaded, setLoaded] = useState(false)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [l, w, tg, f] = await Promise.all([
        loadJSON(KEYS.NUT_LOGS, {}),
        loadJSON(KEYS.NUT_WEIGHTS, {}),
        loadJSON(KEYS.NUT_TARGETS, DEFAULT_TARGETS),
        loadJSON(KEYS.NUT_FOODS, []),
      ])
      setLogs(l); setWeights(w); setTargets(tg); setFoods(f); setLoaded(true)
    })()
  }, [])

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_LOGS, logs) }, [logs, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_WEIGHTS, weights) }, [weights, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_TARGETS, targets) }, [targets, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_FOODS, foods) }, [foods, loaded])

  const day = logs[date] || emptyDay()
  const totals = useMemo(() => dayTotals(day), [day])
  const target = targets[day.dayType] || targets.normal
  const calPct = pct(totals.cal, target.cal)
  const proteinPct = pct(totals.protein, target.protein)

  // ── Mutations ──────────────────────────────────────────────────────────────

  function setDay(updater) {
    setLogs(prev => {
      const cur = prev[date] || emptyDay()
      const next = typeof updater === 'function' ? updater(cur) : updater
      return { ...prev, [date]: next }
    })
  }

  function addItem(slot, item) {
    setDay(d => ({ ...d, [slot]: [...(d[slot] || []), { ...item, id: uid('itm') }] }))
  }

  function removeItem(slot, id) {
    setDay(d => ({ ...d, [slot]: (d[slot] || []).filter(it => it.id !== id) }))
  }

  function setDayType(t) {
    setDay(d => ({ ...d, dayType: t }))
  }

  function setWeight(d, kg) {
    setWeights(prev => {
      const next = { ...prev }
      if (kg == null || kg === '') delete next[d]
      else next[d] = Number(kg)
      return next
    })
  }

  function addFood(food) {
    setFoods(prev => [...prev, { ...food, id: uid('food') }])
  }

  function delFood(id) {
    setFoods(prev => prev.filter(f => f.id !== id))
  }

  if (!loaded) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>Nutrition</div>
        <button style={S.iconBtn} onClick={() => setView('settings')}><Icon name="settings" size={20} /></button>
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 8px', flexShrink: 0 }}>
        {[
          { id: 'day', label: 'Day' },
          { id: 'trend', label: 'Trend' },
          { id: 'foods', label: 'Foods' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1, background: view === v.id ? T.nutrition : 'transparent',
            color: view === v.id ? '#1a1208' : T.text2,
            border: `1px solid ${view === v.id ? T.nutrition : T.border}`,
            borderRadius: 10, padding: '8px 4px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{v.label}</button>
        ))}
      </div>

      {view === 'day' && (
        <DayView
          date={date} setDate={setDate}
          day={day} totals={totals} target={target}
          calPct={calPct} proteinPct={proteinPct}
          weight={weights[date]} setWeight={setWeight}
          setDayType={setDayType}
          onAddItem={(slot) => setModal({ type: 'addItem', slot })}
          onRemoveItem={removeItem}
          onSetWeight={() => setModal({ type: 'weight' })}
        />
      )}

      {view === 'trend' && (
        <TrendView logs={logs} weights={weights} targets={targets} />
      )}

      {view === 'foods' && (
        <FoodsView foods={foods}
          onAdd={() => setModal({ type: 'editFood', food: null })}
          onEdit={(food) => setModal({ type: 'editFood', food })}
          onDelete={delFood} />
      )}

      {view === 'settings' && (
        <SettingsView targets={targets} setTargets={setTargets} onBack={() => setView('day')} />
      )}

      {/* Modals */}
      {modal?.type === 'addItem' && (
        <AddItemModal slot={modal.slot} foods={foods}
          onSaveFood={addFood}
          onClose={() => setModal(null)}
          onSave={(item) => { addItem(modal.slot, item); setModal(null) }} />
      )}
      {modal?.type === 'editFood' && (
        <EditFoodModal food={modal.food}
          onClose={() => setModal(null)}
          onSave={(food) => {
            if (modal.food) setFoods(prev => prev.map(f => f.id === modal.food.id ? { ...food, id: f.id } : f))
            else addFood(food)
            setModal(null)
          }} />
      )}
      {modal?.type === 'weight' && (
        <WeightModal current={weights[date]} date={date}
          onClose={() => setModal(null)}
          onSave={(kg) => { setWeight(date, kg); setModal(null) }} />
      )}
    </div>
  )
}

// ── Day view ─────────────────────────────────────────────────────────────────

function DayView({ date, setDate, day, totals, target, calPct, proteinPct, weight, setDayType, onAddItem, onRemoveItem, onSetWeight }) {
  function shiftDate(days) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <div style={S.scroll}>
      {/* Date strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => shiftDate(-1)} style={{ ...S.iconBtn, background: T.bg2, border: `1px solid ${T.border}` }}>
          <Icon name="back" size={18} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 14, fontWeight: 600, color: T.text }}>
          {date === todayStr() ? 'Today · ' : ''}{fmtDateLong(date)}
        </div>
        <button onClick={() => shiftDate(1)} style={{ ...S.iconBtn, background: T.bg2, border: `1px solid ${T.border}`, transform: 'rotate(180deg)' }}>
          <Icon name="back" size={18} />
        </button>
      </div>

      {/* Day type pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {DAY_TYPES.map(t => (
          <button key={t.id} onClick={() => setDayType(t.id)} style={{
            flex: 1, background: day.dayType === t.id ? t.color : 'transparent',
            color: day.dayType === t.id ? '#0a0e15' : T.text2,
            border: `1px solid ${day.dayType === t.id ? t.color : T.border}`,
            borderRadius: 10, padding: '8px 4px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Calorie ring + protein ring side by side */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
        <RingCard
          label="Calories" value={totals.cal} target={target.cal} unit="kcal"
          color={T.cal} pct={calPct}
        />
        <RingCard
          label="Protein" value={totals.protein} target={target.protein} unit="g"
          color={T.protein} pct={proteinPct}
        />
      </div>

      {/* Body weight tile */}
      <button onClick={onSetWeight} style={{
        display: 'flex', alignItems: 'center', gap: 12, background: T.bg2,
        border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 14,
        width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
      }}>
        <div style={{ color: T.weight }}><Icon name="scale" size={22} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em' }}>Body weight</div>
          {weight != null ? (
            <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: T.text, marginTop: 2 }}>{fmtNum(weight, 1)} kg</div>
          ) : (
            <div style={{ fontSize: 13, color: T.text3, marginTop: 4 }}>Tap to log today's weight</div>
          )}
        </div>
        <Icon name="edit" size={16} color={T.text3} />
      </button>

      {/* Meal slots */}
      {MEAL_SLOTS.map(slot => (
        <MealSlot key={slot.id}
          slot={slot}
          items={day[slot.id] || []}
          onAdd={() => onAddItem(slot.id)}
          onRemove={(id) => onRemoveItem(slot.id, id)} />
      ))}
    </div>
  )
}

function RingCard({ label, value, target, unit, color, pct: p }) {
  const remaining = Math.max(0, target - value)
  const over = value > target
  return (
    <div style={{
      flex: 1, background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: over ? T.bad : T.text }}>
        {fmtNum(value, label === 'Protein' ? 1 : 0)}
      </div>
      <div style={{ fontSize: 12, color: T.text3, marginBottom: 8 }}>
        of <span className="mono">{fmtNum(target)}</span> {unit}
      </div>
      <ProgressBar value={Math.min(p, 100)} color={over ? T.bad : color} height={6} />
      <div style={{ fontSize: 11, color: over ? T.bad : T.text3, marginTop: 6 }}>
        {over ? `${fmtNum(value - target, label === 'Protein' ? 1 : 0)} ${unit} over` : `${fmtNum(remaining, label === 'Protein' ? 1 : 0)} ${unit} left`}
      </div>
    </div>
  )
}

function MealSlot({ slot, items, onAdd, onRemove }) {
  const cal = items.reduce((s, i) => s + (Number(i.cal) || 0), 0)
  const protein = items.reduce((s, i) => s + (Number(i.protein) || 0), 0)

  return (
    <div style={{ ...S.card }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: items.length ? 10 : 0 }}>
        <div style={{ color: T.nutrition }}><Icon name={slot.icon} size={18} /></div>
        <div style={{ flex: 1, fontSize: 15, fontWeight: 700, color: T.text }}>{slot.label}</div>
        {items.length > 0 && (
          <div className="mono" style={{ fontSize: 12, color: T.text3 }}>
            {fmtNum(cal)} kcal · {fmtNum(protein, 1)}g
          </div>
        )}
        <button onClick={onAdd} style={{
          background: T.nutrition, border: 'none', borderRadius: 8, color: '#1a1208',
          padding: '6px 10px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Icon name="plus" size={14} stroke={3} /> Add
        </button>
      </div>
      {items.map(it => (
        <div key={it.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 0', borderTop: `1px solid ${T.border}`,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
            <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
              {fmtNum(it.grams)}g · {fmtNum(it.cal)} kcal · {fmtNum(it.protein, 1)}g protein
            </div>
          </div>
          <button onClick={() => onRemove(it.id)} style={{
            ...S.iconBtn, color: T.text4, padding: 4,
          }}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}

// ── Trend view ───────────────────────────────────────────────────────────────

function TrendView({ logs, weights, targets }) {
  const [range, setRange] = useState(7)

  const data = useMemo(() => {
    return lastNDays(range).map(d => {
      const day = logs[d]
      const tot = day ? dayTotals(day) : { cal: 0, protein: 0 }
      const tType = day?.dayType || 'normal'
      const tg = targets[tType] || targets.normal
      return {
        date: d,
        label: new Date(d + 'T12:00:00').toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        cal: tot.cal,
        protein: tot.protein,
        weight: weights[d] || null,
        calTarget: tg.cal,
        proteinTarget: tg.protein,
      }
    })
  }, [logs, weights, targets, range])

  const avgCal = Math.round(data.filter(d => d.cal > 0).reduce((s, d) => s + d.cal, 0) / Math.max(1, data.filter(d => d.cal > 0).length))
  const avgProtein = Math.round(data.filter(d => d.protein > 0).reduce((s, d) => s + d.protein, 0) / Math.max(1, data.filter(d => d.protein > 0).length))
  const weightVals = data.map(d => d.weight).filter(w => w != null)
  const weightDelta = weightVals.length >= 2 ? (weightVals[weightVals.length - 1] - weightVals[0]) : 0

  return (
    <div style={S.scroll}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[7, 14, 30].map(n => (
          <button key={n} onClick={() => setRange(n)} style={{
            flex: 1, background: range === n ? T.bg3 : 'transparent',
            color: range === n ? T.text : T.text3,
            border: `1px solid ${range === n ? T.borderHi : T.border}`,
            borderRadius: 8, padding: '6px 4px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{n}d</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Stat label="Avg cal" value={isNaN(avgCal) ? '—' : fmtNum(avgCal)} sub="kcal/day" color={T.cal} />
        <Stat label="Avg protein" value={isNaN(avgProtein) ? '—' : fmtNum(avgProtein)} sub="g/day" color={T.protein} />
        <Stat
          label="Weight Δ"
          value={weightVals.length >= 2 ? `${weightDelta > 0 ? '+' : ''}${fmtNum(weightDelta, 1)}` : '—'}
          sub="kg"
          color={weightDelta < 0 ? T.good : weightDelta > 0 ? T.warn : T.text}
        />
      </div>

      {/* Calories chart */}
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Calories</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="cal" fill={T.cal} radius={[4, 4, 0, 0]} />
            <ReferenceLine y={2100} stroke={T.text4} strokeDasharray="3 3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Protein chart */}
      <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Protein</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
            <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="protein" fill={T.protein} radius={[4, 4, 0, 0]} />
            <ReferenceLine y={200} stroke={T.text4} strokeDasharray="3 3" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight chart */}
      {weightVals.length > 0 && (
        <div style={{ ...S.card, padding: '14px 8px 8px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, padding: '0 14px 8px' }}>Body weight (kg)</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data}>
              <XAxis dataKey="label" tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={false} tickLine={false} width={36}
                domain={['dataMin - 0.5', 'dataMax + 0.5']} />
              <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="weight" stroke={T.weight} strokeWidth={2.5}
                dot={{ fill: T.weight, r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

// ── Foods library view ──────────────────────────────────────────────────────

function FoodsView({ foods, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [confirmDel, setConfirmDel] = useState(null)
  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={S.scroll}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search foods..."
          style={{ ...S.input, flex: 1 }}
        />
        <button onClick={onAdd} style={{
          background: T.nutrition, border: 'none', borderRadius: 10, color: '#1a1208',
          padding: '0 14px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
        }}>
          <Icon name="plus" size={16} stroke={3} /> New
        </button>
      </div>

      {filtered.length === 0 && (
        <EmptyState icon="fork"
          title={foods.length === 0 ? "No foods saved yet" : "No matches"}
          hint={foods.length === 0 ? "Save foods you eat often for one-tap logging" : "Try a different search"} />
      )}

      {filtered.map(f => (
        <div key={f.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{f.name}</div>
              <div className="mono" style={{ fontSize: 12, color: T.text3, marginTop: 2 }}>
                {fmtNum(f.calPer100g)} kcal · {fmtNum(f.proteinPer100g, 1)}g protein per 100g
              </div>
              {f.defaultGrams && (
                <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>
                  Default: <span className="mono">{fmtNum(f.defaultGrams)}g</span>
                </div>
              )}
            </div>
            <button style={S.iconBtn} onClick={() => onEdit(f)}><Icon name="edit" size={16} /></button>
            <button style={{ ...S.iconBtn, color: T.bad }} onClick={() => setConfirmDel(f)}><Icon name="trash" size={16} /></button>
          </div>
        </div>
      ))}

      {confirmDel && (
        <Confirm title="Delete food?" message={`"${confirmDel.name}" will be removed from your library.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null) }} />
      )}
    </div>
  )
}

// ── Settings (targets) view ─────────────────────────────────────────────────

function SettingsView({ targets, setTargets, onBack }) {
  const [draft, setDraft] = useState(targets)

  function set(type, field, v) {
    setDraft(d => ({ ...d, [type]: { ...d[type], [field]: Number(v) || 0 } }))
  }

  function save() {
    setTargets(draft)
    onBack()
  }

  return (
    <div style={S.scroll}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button style={S.iconBtn} onClick={onBack}><Icon name="back" /></button>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>Daily targets</div>
      </div>

      {DAY_TYPES.map(t => (
        <div key={t.id} style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{t.label} day</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Calories</div>
              <input type="number" inputMode="numeric"
                value={draft[t.id].cal}
                onChange={e => set(t.id, 'cal', e.target.value)}
                style={S.inputMono} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: T.text3, marginBottom: 4 }}>Protein (g)</div>
              <input type="number" inputMode="numeric"
                value={draft[t.id].protein}
                onChange={e => set(t.id, 'protein', e.target.value)}
                style={S.inputMono} />
            </div>
          </div>
        </div>
      ))}

      <button onClick={save} style={{ ...S.btnPrimary, marginTop: 16, background: T.nutrition }}>Save targets</button>
    </div>
  )
}

// ── Add Item Modal ──────────────────────────────────────────────────────────

function AddItemModal({ slot, foods, onSave, onSaveFood, onClose }) {
  const [mode, setMode] = useState('quick') // 'quick' | 'library'
  const [search, setSearch] = useState('')

  // Quick add fields
  const [name, setName] = useState('')
  const [grams, setGrams] = useState('')
  const [cal, setCal] = useState('')
  const [protein, setProtein] = useState('')
  const [saveToLib, setSaveToLib] = useState(false)

  // Library mode: selected food + grams
  const [selFood, setSelFood] = useState(null)
  const [libGrams, setLibGrams] = useState('')

  function handleQuickSave() {
    if (!name.trim()) return
    const item = {
      name: name.trim(),
      grams: Number(grams) || 0,
      cal: Number(cal) || 0,
      protein: Number(protein) || 0,
    }
    onSave(item)
    if (saveToLib && item.grams > 0) {
      onSaveFood({
        name: item.name,
        defaultGrams: item.grams,
        calPer100g: Math.round((item.cal / item.grams) * 100),
        proteinPer100g: Math.round((item.protein / item.grams) * 100 * 10) / 10,
      })
    }
  }

  function handleLibrarySave() {
    if (!selFood) return
    const g = Number(libGrams) || selFood.defaultGrams || 100
    const item = {
      name: selFood.name,
      grams: g,
      cal: Math.round((selFood.calPer100g * g) / 100),
      protein: Math.round((selFood.proteinPer100g * g) / 100 * 10) / 10,
    }
    onSave(item)
  }

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
  const slotLabel = MEAL_SLOTS.find(s => s.id === slot)?.label || slot

  return (
    <Modal title={`Add to ${slotLabel}`} onClose={onClose} accent={T.nutrition}>
      <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 14 }}>
        {[
          { id: 'quick', label: 'Quick add' },
          { id: 'library', label: `From library (${foods.length})` },
        ].map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            flex: 1, background: mode === m.id ? T.bg3 : 'transparent',
            color: mode === m.id ? T.text : T.text3,
            border: `1px solid ${mode === m.id ? T.borderHi : T.border}`,
            borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{m.label}</button>
        ))}
      </div>

      {mode === 'quick' ? (
        <>
          <label style={S.label}>Name</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Family Mart Chicken Rice" autoFocus />
          <label style={S.label}>Grams</label>
          <input type="number" inputMode="numeric" style={S.inputMono} value={grams} onChange={e => setGrams(e.target.value)} placeholder="0" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Calories</label>
              <input type="number" inputMode="numeric" style={S.inputMono} value={cal} onChange={e => setCal(e.target.value)} placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Protein (g)</label>
              <input type="number" inputMode="decimal" style={S.inputMono} value={protein} onChange={e => setProtein(e.target.value)} placeholder="0" />
            </div>
          </div>
          {grams && cal && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: 14, padding: '10px 12px', background: T.bg3, borderRadius: 10,
            }}>
              <div style={{ fontSize: 13, color: T.text2 }}>Save to food library</div>
              <Toggle on={saveToLib} onChange={setSaveToLib} color={T.nutrition} />
            </div>
          )}
          <button onClick={handleQuickSave} disabled={!name.trim()}
            style={{
              ...S.btnPrimary, marginTop: 18, background: T.nutrition, color: '#1a1208',
              opacity: name.trim() ? 1 : 0.5,
            }}>Add to {slotLabel}</button>
        </>
      ) : (
        <>
          <input style={S.input} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search library..." />
          <div style={{ marginTop: 12, maxHeight: 300, overflowY: 'auto' }}>
            {foods.length === 0 ? (
              <EmptyState icon="fork" title="No foods saved" hint="Use Quick add to log a food, then save it to your library" />
            ) : filtered.map(f => (
              <button key={f.id} onClick={() => { setSelFood(f); setLibGrams(String(f.defaultGrams || 100)) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: selFood?.id === f.id ? T.bg3 : T.bg2,
                  border: `1px solid ${selFood?.id === f.id ? T.nutrition : T.border}`,
                  borderRadius: 10, padding: 12, marginBottom: 6,
                  width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{f.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                    {fmtNum(f.calPer100g)} kcal · {fmtNum(f.proteinPer100g, 1)}g per 100g
                  </div>
                </div>
              </button>
            ))}
          </div>
          {selFood && (
            <>
              <label style={S.label}>Grams</label>
              <input type="number" inputMode="numeric" style={S.inputMono}
                value={libGrams} onChange={e => setLibGrams(e.target.value)} autoFocus />
              <div style={{
                marginTop: 10, padding: '10px 12px', background: T.bg3, borderRadius: 10,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 13, color: T.text2 }}>This serving</div>
                <div className="mono" style={{ fontSize: 13, color: T.text }}>
                  {Math.round((selFood.calPer100g * (Number(libGrams) || 0)) / 100)} kcal · {Math.round((selFood.proteinPer100g * (Number(libGrams) || 0)) / 100 * 10) / 10}g
                </div>
              </div>
              <button onClick={handleLibrarySave}
                style={{ ...S.btnPrimary, marginTop: 18, background: T.nutrition, color: '#1a1208' }}>
                Add to {slotLabel}
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  )
}

// ── Edit Food Modal ──────────────────────────────────────────────────────────

function EditFoodModal({ food, onSave, onClose }) {
  const [name, setName] = useState(food?.name || '')
  const [defaultGrams, setDefaultGrams] = useState(food?.defaultGrams || '')
  const [calPer100g, setCalPer100g] = useState(food?.calPer100g || '')
  const [proteinPer100g, setProteinPer100g] = useState(food?.proteinPer100g || '')

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      defaultGrams: Number(defaultGrams) || 100,
      calPer100g: Number(calPer100g) || 0,
      proteinPer100g: Number(proteinPer100g) || 0,
    })
  }

  return (
    <Modal title={food ? 'Edit food' : 'New food'} onClose={onClose} accent={T.nutrition}>
      <label style={S.label}>Name</label>
      <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Family Mart Chicken Rice" autoFocus />
      <label style={S.label}>Default serving (g)</label>
      <input type="number" inputMode="numeric" style={S.inputMono}
        value={defaultGrams} onChange={e => setDefaultGrams(e.target.value)} placeholder="100" />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Cal per 100g</label>
          <input type="number" inputMode="numeric" style={S.inputMono}
            value={calPer100g} onChange={e => setCalPer100g(e.target.value)} placeholder="0" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={S.label}>Protein per 100g</label>
          <input type="number" inputMode="decimal" style={S.inputMono}
            value={proteinPer100g} onChange={e => setProteinPer100g(e.target.value)} placeholder="0" />
        </div>
      </div>
      <button onClick={handleSave} disabled={!name.trim()}
        style={{
          ...S.btnPrimary, marginTop: 18, background: T.nutrition, color: '#1a1208',
          opacity: name.trim() ? 1 : 0.5,
        }}>{food ? 'Save changes' : 'Add to library'}</button>
    </Modal>
  )
}

// ── Weight Modal ─────────────────────────────────────────────────────────────

function WeightModal({ current, date, onSave, onClose }) {
  const [val, setVal] = useState(current != null ? String(current) : '')

  return (
    <Modal title="Body weight" onClose={onClose} accent={T.weight}>
      <div style={{ fontSize: 13, color: T.text3, marginTop: 6 }}>{fmtDateLong(date)}</div>
      <label style={S.label}>Weight (kg)</label>
      <input type="number" inputMode="decimal" step="0.1" style={S.inputMono}
        value={val} onChange={e => setVal(e.target.value)} placeholder="0.0" autoFocus />
      <button onClick={() => onSave(val ? Number(val) : null)}
        style={{ ...S.btnPrimary, marginTop: 18, background: T.weight, color: '#fff' }}>
        {val ? 'Save' : 'Clear'}
      </button>
    </Modal>
  )
}
