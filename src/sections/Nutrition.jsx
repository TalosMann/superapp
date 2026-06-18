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

import { useState, useEffect, useMemo, useRef } from 'react'
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
  const [savedMeals, setSavedMeals] = useState([])
  const [date, setDate] = useState(todayStr())
  const [view, setView] = useState('day') // 'day' | 'trend' | 'foods' | 'meals' | 'settings'
  const [modal, setModal] = useState(null) // { type, slot? } | { type:'editFood', food } | { type:'weight' } | { type:'saveMeal', slot, items }
  const [loaded, setLoaded] = useState(false)

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [l, w, tg, f, sm] = await Promise.all([
        loadJSON(KEYS.NUT_LOGS, {}),
        loadJSON(KEYS.NUT_WEIGHTS, {}),
        loadJSON(KEYS.NUT_TARGETS, DEFAULT_TARGETS),
        loadJSON(KEYS.NUT_FOODS, []),
        loadJSON(KEYS.NUT_MEALS, []),
      ])
      setLogs(l); setWeights(w); setTargets(tg); setFoods(f); setSavedMeals(sm); setLoaded(true)
    })()
  }, [])

  // ── Persist ────────────────────────────────────────────────────────────────
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_LOGS, logs) }, [logs, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_WEIGHTS, weights) }, [weights, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_TARGETS, targets) }, [targets, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_FOODS, foods) }, [foods, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.NUT_MEALS, savedMeals) }, [savedMeals, loaded])

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

  function saveMeal(name, mealType, items) {
    const cal = Math.round(items.reduce((s, i) => s + (Number(i.cal) || 0), 0))
    const protein = Math.round(items.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10
    setSavedMeals(prev => [
      ...prev,
      { id: uid('meal'), name, mealType, items, cal, protein, savedAt: Date.now() },
    ])
  }

  function delSavedMeal(id) {
    setSavedMeals(prev => prev.filter(m => m.id !== id))
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
          { id: 'meals', label: 'Meals' },
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
          onSaveMeal={(slot, items) => setModal({ type: 'saveMeal', slot, items })}
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

      {view === 'meals' && (
        <MealsView savedMeals={savedMeals} onDelete={delSavedMeal} />
      )}

      {view === 'settings' && (
        <SettingsView targets={targets} setTargets={setTargets} onBack={() => setView('day')} />
      )}

      {/* Modals */}
      {modal?.type === 'addItem' && (
        <AddItemModal slot={modal.slot} foods={foods}
          onSaveFood={addFood}
          onClose={() => setModal(null)}
          onSave={(item, keepOpen) => {
            addItem(modal.slot, item)
            if (!keepOpen) setModal(null)
          }} />
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
      {modal?.type === 'saveMeal' && (
        <SaveMealModal slot={modal.slot} items={modal.items}
          onClose={() => setModal(null)}
          onSave={(name, mealType) => { saveMeal(name, mealType, modal.items); setModal(null) }} />
      )}
    </div>
  )
}

// ── Day view ─────────────────────────────────────────────────────────────────

function DayView({ date, setDate, day, totals, target, calPct, proteinPct, weight, setDayType, onAddItem, onRemoveItem, onSetWeight, onSaveMeal }) {
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
          onRemove={(id) => onRemoveItem(slot.id, id)}
          onSave={() => onSaveMeal(slot.id, day[slot.id] || [])} />
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

function MealSlot({ slot, items, onAdd, onRemove, onSave }) {
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
        {items.length > 0 && (
          <button onClick={onSave} style={{
            background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
            color: T.text3, padding: '5px 10px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }} title="Save as meal preset">
            Save
          </button>
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

  // "Just added: <name>" flash for chained adds — fades after 2s
  const [flash, setFlash] = useState(null)
  const flashTimer = useRef(null)
  function showFlash(text) {
    setFlash(text)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2000)
  }

  // Refs for focus management on chained adds
  const nameRef = useRef(null)
  const searchRef = useRef(null)

  // Build the item payload from current quick-add state. Returns null if invalid.
  function buildQuickItem() {
    if (!name.trim()) return null
    return {
      name: name.trim(),
      grams: Number(grams) || 0,
      cal: Number(cal) || 0,
      protein: Number(protein) || 0,
    }
  }

  function maybeSaveToLibrary(item) {
    if (saveToLib && item.grams > 0) {
      onSaveFood({
        name: item.name,
        defaultGrams: item.grams,
        calPer100g: Math.round((item.cal / item.grams) * 100),
        proteinPer100g: Math.round((item.protein / item.grams) * 100 * 10) / 10,
      })
    }
  }

  function resetQuickFields() {
    setName(''); setGrams(''); setCal(''); setProtein('')
    // Leave saveToLib as the user left it — they likely want consistent behavior
    // across a chain of similar items.
  }

  // Quick add — explicit button click. Saves and closes.
  function handleQuickSaveAndClose() {
    const item = buildQuickItem()
    if (!item) return
    maybeSaveToLibrary(item)
    onSave(item, false)
  }

  // Quick add — Tab-triggered. Saves and keeps modal open for the next item.
  function handleQuickSaveAndContinue() {
    const item = buildQuickItem()
    if (!item) return
    maybeSaveToLibrary(item)
    onSave(item, true)        // keepOpen = true
    showFlash(`Added ${item.name}`)
    resetQuickFields()
    // Jump focus back to Name for the next item
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  // Library — explicit button click. Saves and closes.
  function handleLibrarySaveAndClose() {
    const item = buildLibraryItem()
    if (!item) return
    onSave(item, false)
  }

  // Library — Tab-triggered chain.
  function handleLibrarySaveAndContinue() {
    const item = buildLibraryItem()
    if (!item) return
    onSave(item, true)
    showFlash(`Added ${item.name}`)
    setSelFood(null); setLibGrams(''); setSearch('')
    setTimeout(() => searchRef.current?.focus(), 0)
  }

  function buildLibraryItem() {
    if (!selFood) return null
    const g = Number(libGrams) || selFood.defaultGrams || 100
    return {
      name: selFood.name,
      grams: g,
      cal: Math.round((selFood.calPer100g * g) / 100),
      protein: Math.round((selFood.proteinPer100g * g) / 100 * 10) / 10,
    }
  }

  // Intercept Tab on the last field to trigger chain-save.
  // We use onKeyDown rather than Enter because Enter on a number input
  // can submit unwanted, and Tab is a natural "I'm done with this row" gesture.
  function onProteinKeyDown(e) {
    if (e.key === 'Tab' && !e.shiftKey && name.trim()) {
      e.preventDefault()
      handleQuickSaveAndContinue()
    }
  }

  function onLibGramsKeyDown(e) {
    if (e.key === 'Tab' && !e.shiftKey && selFood) {
      e.preventDefault()
      handleLibrarySaveAndContinue()
    }
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

      {/* "Just added" flash — sits above the form, doesn't shift layout */}
      {flash && (
        <div style={{
          background: T.good, color: '#0a0e15', padding: '8px 12px',
          borderRadius: 8, fontSize: 12, fontWeight: 700, marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="check" size={14} stroke={3} /> {flash}
        </div>
      )}

      {mode === 'quick' ? (
        <>
          <label style={S.label}>Name</label>
          <input ref={nameRef} style={S.input} value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Family Mart Chicken Rice" autoFocus />
          <label style={S.label}>Grams</label>
          <input type="number" inputMode="numeric" style={S.inputMono}
            value={grams} onChange={e => setGrams(e.target.value)} placeholder="0" />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Calories</label>
              <input type="number" inputMode="numeric" style={S.inputMono}
                value={cal} onChange={e => setCal(e.target.value)} placeholder="0" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Protein (g)</label>
              <input type="number" inputMode="decimal" style={S.inputMono}
                value={protein} onChange={e => setProtein(e.target.value)}
                onKeyDown={onProteinKeyDown}
                placeholder="0" />
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
          <div style={{
            fontSize: 11, color: T.text3, marginTop: 14, lineHeight: 1.4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <kbd style={{
              background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 4,
              padding: '1px 6px', fontFamily: "'DM Mono', monospace", fontSize: 10,
              color: T.text2,
            }}>Tab</kbd>
            <span>from Protein to add &amp; keep adding more items</span>
          </div>
          <button onClick={handleQuickSaveAndClose} disabled={!name.trim()}
            style={{
              ...S.btnPrimary, marginTop: 10, background: T.nutrition, color: '#1a1208',
              opacity: name.trim() ? 1 : 0.5,
            }}>Add &amp; close</button>
        </>
      ) : (
        <>
          <input ref={searchRef} style={S.input} value={search}
            onChange={e => setSearch(e.target.value)} placeholder="Search library..." />
          <div style={{ marginTop: 12, maxHeight: 260, overflowY: 'auto' }}>
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
                value={libGrams} onChange={e => setLibGrams(e.target.value)}
                onKeyDown={onLibGramsKeyDown}
                autoFocus />
              <div style={{
                marginTop: 10, padding: '10px 12px', background: T.bg3, borderRadius: 10,
                display: 'flex', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 13, color: T.text2 }}>This serving</div>
                <div className="mono" style={{ fontSize: 13, color: T.text }}>
                  {Math.round((selFood.calPer100g * (Number(libGrams) || 0)) / 100)} kcal · {Math.round((selFood.proteinPer100g * (Number(libGrams) || 0)) / 100 * 10) / 10}g
                </div>
              </div>
              <div style={{
                fontSize: 11, color: T.text3, marginTop: 14, lineHeight: 1.4,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <kbd style={{
                  background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 4,
                  padding: '1px 6px', fontFamily: "'DM Mono', monospace", fontSize: 10,
                  color: T.text2,
                }}>Tab</kbd>
                <span>from Grams to add &amp; keep adding more items</span>
              </div>
              <button onClick={handleLibrarySaveAndClose}
                style={{ ...S.btnPrimary, marginTop: 10, background: T.nutrition, color: '#1a1208' }}>
                Add &amp; close
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

// ── Meals library view ──────────────────────────────────────────────────────

const CAL_RANGES = [
  { id: 'all',  label: 'Any cal',   min: 0,    max: Infinity },
  { id: 'u400', label: '< 400',     min: 0,    max: 399 },
  { id: 'u600', label: '400–600',   min: 400,  max: 599 },
  { id: 'u800', label: '600–800',   min: 600,  max: 799 },
  { id: 'u1k',  label: '800–1000',  min: 800,  max: 999 },
  { id: 'o1k',  label: '1000+',     min: 1000, max: Infinity },
]

const SLOT_FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch',     label: 'Lunch' },
  { id: 'dinner',    label: 'Dinner' },
  { id: 'snacks',    label: 'Snacks' },
]

function MealsView({ savedMeals, onDelete }) {
  const [slotFilter, setSlotFilter] = useState('all')
  const [calFilter, setCalFilter] = useState('all')
  const [confirmDel, setConfirmDel] = useState(null)

  const calRange = CAL_RANGES.find(r => r.id === calFilter) || CAL_RANGES[0]

  const filtered = savedMeals
    .filter(m => slotFilter === 'all' || m.mealType === slotFilter)
    .filter(m => m.cal >= calRange.min && m.cal <= calRange.max)
    .sort((a, b) => b.cal - a.cal || b.protein - a.protein)

  // Group filtered meals by meal type for display
  const grouped = SLOT_FILTERS.slice(1).reduce((acc, s) => {
    const group = filtered.filter(m => m.mealType === s.id)
    if (group.length) acc.push({ slotId: s.id, label: s.label, meals: group })
    return acc
  }, [])

  const showGrouped = slotFilter === 'all'

  return (
    <div style={S.scroll}>
      {/* Meal type filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
        {SLOT_FILTERS.map(s => (
          <button key={s.id} onClick={() => setSlotFilter(s.id)} style={{
            background: slotFilter === s.id ? T.nutrition : 'transparent',
            color: slotFilter === s.id ? '#1a1208' : T.text2,
            border: `1px solid ${slotFilter === s.id ? T.nutrition : T.border}`,
            borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{s.label}</button>
        ))}
      </div>

      {/* Calorie range filter */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {CAL_RANGES.map(r => (
          <button key={r.id} onClick={() => setCalFilter(r.id)} style={{
            background: calFilter === r.id ? T.cal : 'transparent',
            color: calFilter === r.id ? '#1a1208' : T.text3,
            border: `1px solid ${calFilter === r.id ? T.cal : T.border}`,
            borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}>{r.label}</button>
        ))}
      </div>

      {savedMeals.length === 0 && (
        <EmptyState icon="fork"
          title="No saved meals yet"
          hint="Log items into a meal slot, then tap Save to add it here" />
      )}

      {savedMeals.length > 0 && filtered.length === 0 && (
        <EmptyState icon="fork" title="No meals match" hint="Try a different meal type or calorie range" />
      )}

      {showGrouped ? grouped.map(({ slotId, label, meals }) => (
        <div key={slotId}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase',
            letterSpacing: '.06em', marginBottom: 6, marginTop: 4,
          }}>{label}</div>
          {meals.map(m => (
            <MealCard key={m.id} meal={m} onDelete={() => setConfirmDel(m)} />
          ))}
        </div>
      )) : filtered.map(m => (
        <MealCard key={m.id} meal={m} onDelete={() => setConfirmDel(m)} />
      ))}

      {confirmDel && (
        <Confirm title="Delete saved meal?"
          message={`"${confirmDel.name}" will be removed from your saved meals.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null) }} />
      )}
    </div>
  )
}

function MealCard({ meal, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const slotLabel = SLOT_FILTERS.find(s => s.id === meal.mealType)?.label || meal.mealType

  return (
    <div style={{ ...S.card, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button onClick={() => setExpanded(e => !e)} style={{
          flex: 1, background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.nutrition,
              background: `${T.nutrition}22`, borderRadius: 4, padding: '2px 6px',
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>{slotLabel}</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{meal.name}</div>
          <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 12, color: T.cal, fontWeight: 600 }}>
              {fmtNum(meal.cal)} kcal
            </span>
            <span className="mono" style={{ fontSize: 12, color: T.protein, fontWeight: 600 }}>
              {fmtNum(meal.protein, 1)}g protein
            </span>
            <span style={{ fontSize: 12, color: T.text4 }}>
              {meal.items.length} item{meal.items.length !== 1 ? 's' : ''}
            </span>
          </div>
        </button>
        <button onClick={onDelete} style={{ ...S.iconBtn, color: T.bad, padding: 4, flexShrink: 0 }}>
          <Icon name="trash" size={16} />
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 8 }}>
          {meal.items.map((it, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: i > 0 ? 6 : 0, marginTop: i > 0 ? 6 : 0,
              borderTop: i > 0 ? `1px solid ${T.border}` : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{fmtNum(it.grams)}g</div>
              </div>
              <div className="mono" style={{ fontSize: 12, color: T.text2, textAlign: 'right' }}>
                <div>{fmtNum(it.cal)} kcal</div>
                <div style={{ color: T.text3, fontSize: 11 }}>{fmtNum(it.protein, 1)}g</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Save Meal Modal ───────────────────────────────────────────────────────────

function SaveMealModal({ slot, items, onSave, onClose }) {
  const defaultName = ''
  const [name, setName] = useState(defaultName)
  const [mealType, setMealType] = useState(slot)

  const cal = Math.round(items.reduce((s, i) => s + (Number(i.cal) || 0), 0))
  const protein = Math.round(items.reduce((s, i) => s + (Number(i.protein) || 0), 0) * 10) / 10

  return (
    <Modal title="Save meal" onClose={onClose} accent={T.nutrition}>
      {/* Summary */}
      <div style={{
        background: T.bg3, borderRadius: 10, padding: '10px 14px',
        display: 'flex', gap: 16, marginBottom: 14, marginTop: 6,
      }}>
        <div>
          <div style={{ fontSize: 11, color: T.text3 }}>Calories</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.cal }}>{fmtNum(cal)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.text3 }}>Protein</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.protein }}>{fmtNum(protein, 1)}g</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: T.text3 }}>Items</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{items.length}</div>
        </div>
      </div>

      <label style={S.label}>Meal name</label>
      <input style={S.input} value={name} onChange={e => setName(e.target.value)}
        placeholder="e.g. Apple + Milk morning" autoFocus />

      <label style={{ ...S.label, marginTop: 12 }}>Meal type</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
        {SLOT_FILTERS.slice(1).map(s => (
          <button key={s.id} onClick={() => setMealType(s.id)} style={{
            flex: 1, background: mealType === s.id ? T.nutrition : 'transparent',
            color: mealType === s.id ? '#1a1208' : T.text2,
            border: `1px solid ${mealType === s.id ? T.nutrition : T.border}`,
            borderRadius: 8, padding: '7px 2px', fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{s.label}</button>
        ))}
      </div>

      <button onClick={() => onSave(name.trim() || 'Unnamed meal', mealType)}
        style={{ ...S.btnPrimary, marginTop: 16, background: T.nutrition, color: '#1a1208' }}>
        Save meal
      </button>
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
