/**
 * HistoryView.jsx — Archived goals grouped by tier + period.
 * Read-only — no editing past goals.
 */

import { useState, useMemo } from 'react'
import { T, S } from '../../theme.js'
import { EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { TIERS, periodLabel } from './data.js'

export default function HistoryView({ archive }) {
  const [tier, setTier] = useState('daily')

  // Group archive by periodId, newest first
  const groups = useMemo(() => {
    const byPeriod = {}
    for (const g of archive) {
      if (g.tier !== tier) continue
      const k = g.periodId
      if (!byPeriod[k]) byPeriod[k] = []
      byPeriod[k].push(g)
    }
    return Object.entries(byPeriod)
      .sort(([a], [b]) => (a < b ? 1 : -1))
  }, [archive, tier])

  return (
    <div style={S.scroll}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {TIERS.map(t => (
          <button key={t.id} onClick={() => setTier(t.id)} style={{
            flex: 1,
            background: tier === t.id ? t.color : 'transparent',
            color: tier === t.id ? '#0a0e15' : T.text2,
            border: `1px solid ${tier === t.id ? t.color : T.border}`,
            borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.label}</button>
        ))}
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon="history"
          title="No past goals yet"
          hint={`Completed and missed ${tier} goals will appear here once their period ends.`}
        />
      ) : groups.map(([periodId, goals]) => {
        const done = goals.filter(g => g.status === 'done').length
        const total = goals.length
        const pct = Math.round((done / total) * 100)

        return (
          <div key={periodId} style={{ marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 4px 6px',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, textTransform: 'uppercase', letterSpacing: '.04em' }}>
                {periodLabel(tier, periodId)}
              </div>
              <div className="mono" style={{ fontSize: 11, color: T.text3 }}>
                {done}/{total} · {pct}%
              </div>
            </div>
            {goals.map(g => (
              <div key={g.id} style={{
                background: T.bg2, border: `1px solid ${T.border}`,
                borderLeft: `3px solid ${g.status === 'done' ? T.good : T.bad}`,
                borderRadius: 8, padding: '8px 12px', marginBottom: 4,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 9,
                  background: g.status === 'done' ? T.good : T.bg3,
                  border: g.status === 'done' ? 'none' : `1px solid ${T.bad}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: g.status === 'done' ? '#0a0e15' : T.bad, flexShrink: 0,
                }}>
                  {g.status === 'done' ? <Icon name="check" size={10} stroke={3} /> : '×'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, color: T.text,
                    textDecoration: g.status === 'done' ? 'line-through' : 'none',
                    opacity: g.status === 'done' ? 0.7 : 1,
                  }}>
                    {g.title}
                  </div>
                  {g.kind === 'counter' && (
                    <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                      {g.progress || 0} / {g.target}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
