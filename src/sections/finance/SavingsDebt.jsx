/**
 * SavingsDebt.jsx — Savings goals and debt payoff views for the Finance module.
 *
 * Split into its own file (separate from Finance.jsx) because the payoff
 * calculator carries enough state/logic to be worth isolating. Kept
 * self-contained (no shared imports from Finance.jsx) to avoid a circular
 * import, since Finance.jsx imports from here.
 *
 * "Savings" is the renamed version of TalosFinance's "Goals" tab — Personal
 * already has its own Goals module (daily/weekly/monthly tiers), so this
 * avoids the name collision in the bottom nav / mental model.
 */

import { useState, useMemo } from 'react'
import { T, S } from '../../theme.js'
import { EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { calcPayoff, savingsEta, savingsPct } from './data.js'

function CatDot({ color, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color, marginRight: 6, flexShrink: 0, verticalAlign: 'middle' }} />
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ background: 'transparent', border: 'none', color: T.text4, cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}>
      <Icon name="close" size={16} />
    </button>
  )
}

function AddBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{
      background: T.finance, border: 'none', borderRadius: 10, color: '#0a0e15',
      padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
    }}><Icon name="plus" size={14} stroke={3} /> {label}</button>
  )
}

// ── Savings ──────────────────────────────────────────────────────────────────

export function SavingsView({ savings, fmt, onAdd, onDelete, onContrib }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, marginBottom: 14 }}>
        <AddBtn onClick={onAdd} label="New Goal" />
      </div>
      {savings.length === 0 && <EmptyState icon="target" title="No savings goals yet" hint="Set a target and track progress toward it." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {savings.map(s => {
          const pct = savingsPct(s)
          const remaining = s.target - s.current
          const eta = savingsEta(s)
          return (
            <div key={s.id} style={{ ...S.card, padding: 18, borderTop: `3px solid ${s.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{s.name}</div>
                <DeleteBtn onClick={() => onDelete(s)} />
              </div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '4px 0 4px' }}>{fmt(s.current)}</div>
              <div style={{ fontSize: 12, color: T.text4, marginBottom: 12 }}>of {fmt(s.target)} goal</div>
              <div style={{ height: 8, background: T.bg3, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: 8, background: s.color }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text4, marginTop: 7 }}>
                <span>{pct.toFixed(1)}% complete</span>
                {s.deadline && <span>Due {new Date(s.deadline + 'T12:00:00').toLocaleDateString('en', { month: 'short', year: 'numeric' })}</span>}
              </div>
              {eta != null && <div style={{ fontSize: 12, color: T.text3, marginTop: 6 }}>≈ {eta} mo at {fmt(s.monthlyContrib)}/mo</div>}
              <button onClick={() => onContrib(s)} style={{
                marginTop: 14, width: '100%', background: 'transparent', border: `1px solid ${s.color}`,
                borderRadius: 10, padding: 11, color: s.color, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>+ Add Contribution</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Debt ─────────────────────────────────────────────────────────────────────

export function DebtView({ debts, fmt, onAdd, onDelete }) {
  const [strategy, setStrategy] = useState('avalanche')
  const [extra, setExtra] = useState(200)

  const totDebt = debts.reduce((s, d) => s + d.balance, 0)
  const totMin = debts.reduce((s, d) => s + d.minPayment, 0)
  const payoff = useMemo(() => calcPayoff(debts, strategy, extra), [debts, strategy, extra])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4, marginBottom: 14 }}>
        <AddBtn onClick={onAdd} label="Add Debt" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        <div style={{ ...S.card, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Total Debt</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: T.bad }}>{fmt(totDebt)}</div>
        </div>
        <div style={{ ...S.card, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Min/mo</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: T.warn }}>{fmt(totMin)}</div>
        </div>
        <div style={{ ...S.card, padding: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Payoff</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: T.finance }}>{payoff.months} mo</div>
        </div>
      </div>

      {debts.length === 0 && <EmptyState icon="wallet" title="No debts logged" hint="Track loans, credit cards, or mortgages here." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {debts.map(d => (
          <div key={d.id} style={{ ...S.card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 700, color: T.text }}>{d.name}</div>
                <div style={{ fontSize: 12, color: T.text4, marginTop: 2 }}>{d.type} · {d.rate}% APR</div>
              </div>
              <DeleteBtn onClick={() => onDelete(d)} />
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: T.bad, marginBottom: 4 }}>{fmt(d.balance)}</div>
            <div style={{ fontSize: 12, color: T.text4 }}>Min: {fmt(d.minPayment)}/mo · Interest: {fmt(d.balance * d.rate / 100 / 12)}/mo</div>
          </div>
        ))}
      </div>

      {debts.length > 0 && (
        <div style={{ ...S.card, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 14 }}>Payoff Calculator</div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'block' }}>Strategy</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['avalanche', 'snowball'].map(s => (
                <button key={s} onClick={() => setStrategy(s)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 700,
                  border: `1px solid ${strategy === s ? T.finance : T.border}`,
                  background: strategy === s ? `${T.finance}22` : 'transparent',
                  color: strategy === s ? T.finance : T.text3, cursor: 'pointer', fontFamily: 'inherit',
                  textTransform: 'capitalize',
                }}>{s}</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.text4, marginTop: 6 }}>
              {strategy === 'avalanche' ? 'Highest rate first — minimizes total interest' : 'Smallest balance first — builds motivation'}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'block' }}>Extra Monthly Payment</label>
            <input type="number" inputMode="decimal" value={extra} min="0" onChange={e => setExtra(e.target.value)} style={{
              background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
              color: T.text, fontSize: 14, width: '100%', fontFamily: 'inherit', outline: 'none',
            }} />
          </div>
          <div style={{ background: T.bg3, borderRadius: 10, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: T.text3 }}>Payoff Time</span>
              <span className="mono" style={{ color: T.finance, fontWeight: 700 }}>{payoff.months} months</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: T.text3 }}>Total Interest</span>
              <span className="mono" style={{ color: T.warn, fontWeight: 700 }}>{fmt(payoff.interest)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
