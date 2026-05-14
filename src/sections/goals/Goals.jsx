/**
 * Goals.jsx — Module root. Owns goals + archive state.
 *
 * Goal data shape:
 *   id            string
 *   title         string
 *   tier          'daily' | 'weekly' | 'monthly'
 *   kind          'check' | 'counter'
 *   target        number  (counter only)
 *   progress      number  (counter only)
 *   checkedAt     ISO string | null  (check only)
 *   periodId      string  — the period this goal belongs to ("2026-05-11" etc)
 *   status        'active' | 'done' | 'missed' — set on archive
 *   notes         string
 *   linkedEventId string | null
 *   linkedEventTitle string | null
 *   linkedEventDay   string | null
 *   recurrence    'once' | 'count' | null
 *   recurrenceCount number | null
 *   createdAt     ISO string
 *
 * Rollover logic (runs once on mount):
 *   For each active goal whose periodId is past the current periodId for
 *   its tier, move it to archive with status 'done' (if completed) or
 *   'missed'. If it had a recurring link with recurrenceCount > 1, also
 *   create a fresh instance for the new period with count - 1.
 *   This is the only place periodId is checked — no constant polling.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../../theme.js'
import { Confirm, EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { uid } from '../../utils.js'
import { loadJSON, saveJSON, KEYS } from '../../storage.js'
import { TIERS, TIER_BY_ID, currentPeriodId } from './data.js'
import GoalCard from './GoalCard.jsx'
import GoalForm from './GoalForm.jsx'
import HistoryView from './HistoryView.jsx'

export default function Goals() {
  const [loaded, setLoaded] = useState(false)
  const [goals, setGoals] = useState([])
  const [archive, setArchive] = useState([])
  const [view, setView] = useState('active') // 'active' | 'history'
  const [modal, setModal] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  // ── Load + run rollover on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [g, a, events] = await Promise.all([
        loadJSON(KEYS.GOALS_ACTIVE, []),
        loadJSON(KEYS.GOALS_ARCHIVE, []),
        loadJSON(KEYS.TT_EVENTS, []),
      ])
      // Auto-unlink goals whose linked event no longer exists.
      const validGroupIds = new Set(events.map(e => e.groupId).filter(Boolean))
      const cleaned = g.map(goal => {
        if (goal.linkedEventGroupId && !validGroupIds.has(goal.linkedEventGroupId)) {
          return {
            ...goal,
            linkedEventId: null,
            linkedEventGroupId: null,
            linkedEventTitle: null,
            linkedEventDay: null,
            recurrence: null,
            recurrenceCount: null,
          }
        }
        return goal
      })
      const { active, archived } = rollover(cleaned, a)
      setGoals(active)
      setArchive(archived)
      setLoaded(true)
    })()
  }, [])

  useEffect(() => { if (loaded) saveJSON(KEYS.GOALS_ACTIVE, goals) }, [goals, loaded])
  useEffect(() => { if (loaded) saveJSON(KEYS.GOALS_ARCHIVE, archive) }, [archive, loaded])

  // ── Mutations ────────────────────────────────────────────────────────────

  function handleAdd(form) {
    const goal = {
      id: uid('goal'),
      ...form,
      progress: form.kind === 'counter' ? 0 : null,
      checkedAt: null,
      periodId: currentPeriodId(form.tier),
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    setGoals(prev => [...prev, goal])
    setModal(null)
  }

  function handleEdit(form) {
    setGoals(prev => prev.map(g =>
      g.id === modal.goal.id ? { ...g, ...form } : g
    ))
    setModal(null)
  }

  function handleDelete() {
    setConfirmDel({ id: modal.goal.id, title: modal.goal.title })
  }

  function confirmDelete() {
    setGoals(prev => prev.filter(g => g.id !== confirmDel.id))
    setConfirmDel(null)
    setModal(null)
  }

  function toggleCheck(goal) {
    setGoals(prev => prev.map(g => {
      if (g.id !== goal.id) return g
      return { ...g, checkedAt: g.checkedAt ? null : new Date().toISOString() }
    }))
  }

  function increment(goal) {
    setGoals(prev => prev.map(g => {
      if (g.id !== goal.id) return g
      const next = (g.progress || 0) + 1
      return { ...g, progress: Math.min(next, g.target) }
    }))
  }

  function decrement(goal) {
    setGoals(prev => prev.map(g => {
      if (g.id !== goal.id) return g
      return { ...g, progress: Math.max(0, (g.progress || 0) - 1) }
    }))
  }

  if (!loaded) return null

  // ── Group active goals by tier ───────────────────────────────────────────
  const byTier = { daily: [], weekly: [], monthly: [] }
  for (const g of goals) byTier[g.tier]?.push(g)

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>Goals</div>
        <button style={S.iconBtn} onClick={() => setView(v => v === 'active' ? 'history' : 'active')}>
          <Icon name={view === 'active' ? 'history' : 'close'} size={20} />
        </button>
      </div>

      {/* View tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 16px 10px', flexShrink: 0 }}>
        {[
          { id: 'active', label: 'Active' },
          { id: 'history', label: 'History' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1,
            background: view === v.id ? T.goals : 'transparent',
            color: view === v.id ? '#0a0e15' : T.text2,
            border: `1px solid ${view === v.id ? T.goals : T.border}`,
            borderRadius: 10, padding: '8px 4px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{v.label}</button>
        ))}
      </div>

      {view === 'active' && (
        <div style={S.scroll}>
          {goals.length === 0 ? (
            <EmptyState
              icon="target"
              title="No active goals"
              hint="Tap + to add your first daily, weekly, or monthly goal."
            />
          ) : TIERS.map(tier => {
            const tg = byTier[tier.id]
            if (!tg.length) return null
            const done = tg.filter(g =>
              g.kind === 'check' ? g.checkedAt : (g.progress || 0) >= g.target
            ).length

            return (
              <div key={tier.id} style={{ marginBottom: 18 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0 4px 8px',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: tier.color,
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>{tier.label}</div>
                  <div className="mono" style={{ fontSize: 11, color: T.text3 }}>
                    {done}/{tg.length}
                  </div>
                </div>
                {tg.map(goal => (
                  <GoalCard key={goal.id} goal={goal}
                    onToggle={() => toggleCheck(goal)}
                    onIncrement={() => increment(goal)}
                    onDecrement={() => decrement(goal)}
                    onEdit={() => setModal({ type: 'edit', goal })}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}

      {view === 'history' && <HistoryView archive={archive} />}

      {view === 'active' && (
        <button onClick={() => setModal({ type: 'add' })} style={{
          ...S.fab, background: T.goals,
          boxShadow: '0 6px 24px rgba(52,211,153,0.35)',
        }}>
          <Icon name="plus" size={26} color="#0a0e15" stroke={3} />
        </button>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <GoalForm
          isEdit={false}
          onSave={handleAdd}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'edit' && (
        <GoalForm
          isEdit={true}
          initial={modal.goal}
          onSave={handleEdit}
          onDelete={handleDelete}
          onCancel={() => setModal(null)}
        />
      )}

      {confirmDel && (
        <Confirm
          title="Delete goal?"
          message={`"${confirmDel.title}" will be permanently removed.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={confirmDelete}
          danger
        />
      )}
    </div>
  )
}

// ── Rollover ─────────────────────────────────────────────────────────────────

/**
 * Move expired goals to archive. Recurring goals (recurrence === 'count' with
 * recurrenceCount > 1) get a fresh instance with count - 1 in the new period.
 * Recurring goals with recurrence === 'once' just archive when their period
 * ends — they fire on the next event occurrence and that's it.
 *
 * Returns { active, archived }.
 */
function rollover(goals, archive) {
  const fresh = []
  const newlyArchived = []

  for (const g of goals) {
    const cur = currentPeriodId(g.tier)
    if (g.periodId === cur) {
      // Still in the current period — keep active
      fresh.push(g)
      continue
    }

    // Period has passed — archive
    const done = g.kind === 'check'
      ? g.checkedAt != null
      : (g.progress || 0) >= g.target
    newlyArchived.push({
      ...g,
      status: done ? 'done' : 'missed',
    })

    // Recurring count → create fresh instance for new period if count > 1
    if (g.recurrence === 'count' && (g.recurrenceCount || 0) > 1) {
      fresh.push({
        ...g,
        id: uid('goal'),
        progress: g.kind === 'counter' ? 0 : null,
        checkedAt: null,
        periodId: cur,
        recurrenceCount: g.recurrenceCount - 1,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return {
    active: fresh,
    archived: [...archive, ...newlyArchived],
  }
}
