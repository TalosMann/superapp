/**
 * FinanceModals.jsx — All create/edit modals for the Finance module.
 *
 * Restyled to Personal's theme (T/S) and shared <Modal>, in place of
 * TalosFinance's standalone CSS classes (.inp, .sel, .fg, .lbl, .btn-p, .btn-g).
 * Categories are picked by id everywhere, never by name string.
 */

import { useState } from 'react'
import { T, S } from '../../theme.js'
import { Modal } from '../../shared.jsx'
import { todayStr } from '../../utils.js'

const fieldLabel = { fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'block' }
const fieldGroup = { marginBottom: 14 }
const selectStyle = {
  background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10,
  padding: '10px 12px', color: T.text, fontSize: 14, width: '100%',
  fontFamily: 'inherit', outline: 'none',
}
const btnRow = { display: 'flex', gap: 10, marginTop: 6 }
const btnGhost = { flex: 1, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, color: T.text2, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }
const btnPrimary = (color = T.finance) => ({ flex: 1, background: color, border: 'none', borderRadius: 10, padding: 12, color: '#0a0e15', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' })

function Field({ label, children }) {
  return <div style={fieldGroup}><label style={fieldLabel}>{label}</label>{children}</div>
}

// ── Transaction ──────────────────────────────────────────────────────────────

export function TxModal({ onClose, onSave, categories }) {
  const expenseCats = categories.filter(c => c.id !== 'income')
  const [f, sf] = useState({ date: todayStr(), desc: '', amount: '', type: 'expense', categoryId: expenseCats[0]?.id, tags: '' })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = f.desc.trim() && Number(f.amount) > 0

  function handleTypeChange(type) {
    sf(p => ({ ...p, type, categoryId: type === 'income' ? 'income' : (expenseCats[0]?.id || p.categoryId) }))
  }

  return (
    <Modal title="Add Transaction" onClose={onClose} accent={T.finance}>
      <Field label="Date"><input style={S.input} type="date" value={f.date} onChange={upd('date')} /></Field>
      <Field label="Description"><input style={S.input} placeholder="e.g. Grocery Store" value={f.desc} onChange={upd('desc')} /></Field>
      <Field label="Amount"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.amount} onChange={upd('amount')} /></Field>
      <Field label="Type">
        <div style={{ display: 'flex', gap: 8 }}>
          {['expense', 'income'].map(t => (
            <button key={t} onClick={() => handleTypeChange(t)} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 700,
              border: `1px solid ${f.type === t ? T.finance : T.border}`,
              background: f.type === t ? `${T.finance}22` : 'transparent',
              color: f.type === t ? T.finance : T.text3, cursor: 'pointer', fontFamily: 'inherit',
            }}>{t === 'income' ? 'Income' : 'Expense'}</button>
          ))}
        </div>
      </Field>
      {f.type === 'expense' && (
        <Field label="Category">
          <select style={selectStyle} value={f.categoryId} onChange={upd('categoryId')}>
            {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="Tags (comma separated)"><input style={S.input} placeholder="e.g. monthly, subscription" value={f.tags} onChange={upd('tags')} /></Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => {
          onSave({
            date: f.date, desc: f.desc.trim(), amount: Number(f.amount), type: f.type,
            categoryId: f.type === 'income' ? 'income' : f.categoryId,
            tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          })
        }}>Save</button>
      </div>
    </Modal>
  )
}

// ── Budget ───────────────────────────────────────────────────────────────────

export function BudgetModal({ onClose, onSave, categories }) {
  const expenseCats = categories.filter(c => c.id !== 'income')
  const [f, sf] = useState({ categoryId: expenseCats[0]?.id, limit: '' })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = Number(f.limit) > 0

  return (
    <Modal title="Add Budget" onClose={onClose} accent={T.finance}>
      <Field label="Category">
        <select style={selectStyle} value={f.categoryId} onChange={upd('categoryId')}>
          {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Monthly Limit"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.limit} onChange={upd('limit')} /></Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => {
          onSave({ categoryId: f.categoryId, limit: Number(f.limit), period: 'monthly', rollover: false })
        }}>Save</button>
      </div>
    </Modal>
  )
}

// ── Savings goal ─────────────────────────────────────────────────────────────

const SAVINGS_COLORS = ['#06c6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899']

export function SavingsModal({ onClose, onSave }) {
  const [f, sf] = useState({ name: '', target: '', deadline: '', color: SAVINGS_COLORS[0], monthlyContrib: '' })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = f.name.trim() && Number(f.target) > 0

  return (
    <Modal title="New Savings Goal" onClose={onClose} accent={T.finance}>
      <Field label="Goal Name"><input style={S.input} placeholder="e.g. Emergency Fund" value={f.name} onChange={upd('name')} /></Field>
      <Field label="Target Amount"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.target} onChange={upd('target')} /></Field>
      <Field label="Deadline"><input style={S.input} type="date" value={f.deadline} onChange={upd('deadline')} /></Field>
      <Field label="Monthly Contribution"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.monthlyContrib} onChange={upd('monthlyContrib')} /></Field>
      <Field label="Color">
        <div style={{ display: 'flex', gap: 8 }}>
          {SAVINGS_COLORS.map(c => (
            <div key={c} onClick={() => sf(p => ({ ...p, color: c }))} style={{
              width: 30, height: 30, borderRadius: '50%', background: c, cursor: 'pointer',
              border: `3px solid ${f.color === c ? T.text : 'transparent'}`, transition: 'border .15s',
            }} />
          ))}
        </div>
      </Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => {
          onSave({ name: f.name.trim(), target: Number(f.target), deadline: f.deadline, color: f.color, monthlyContrib: Number(f.monthlyContrib || 0) })
        }}>Create</button>
      </div>
    </Modal>
  )
}

export function ContribModal({ saving, onClose, onSave, fmt }) {
  const [amt, setAmt] = useState('')
  const valid = Number(amt) > 0

  return (
    <Modal title={`Contribute to ${saving.name}`} onClose={onClose} accent={saving.color}>
      <div style={{ fontSize: 13, color: T.text3, marginBottom: 14 }}>{fmt(saving.current)} / {fmt(saving.target)}</div>
      <Field label="Amount"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={amt} onChange={e => setAmt(e.target.value)} autoFocus /></Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(saving.color), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => onSave(Number(amt))}>Add</button>
      </div>
    </Modal>
  )
}

// ── Debt ─────────────────────────────────────────────────────────────────────

export function DebtModal({ onClose, onSave }) {
  const [f, sf] = useState({ name: '', balance: '', rate: '', minPayment: '', type: 'loan' })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = f.name.trim() && Number(f.balance) > 0

  return (
    <Modal title="Add Debt" onClose={onClose} accent={T.finance}>
      <Field label="Name"><input style={S.input} placeholder="e.g. Credit Card" value={f.name} onChange={upd('name')} /></Field>
      <Field label="Balance"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.balance} onChange={upd('balance')} /></Field>
      <Field label="Interest Rate (APR %)"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="19.99" value={f.rate} onChange={upd('rate')} /></Field>
      <Field label="Min Monthly Payment"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.minPayment} onChange={upd('minPayment')} /></Field>
      <Field label="Type">
        <select style={selectStyle} value={f.type} onChange={upd('type')}>
          <option value="loan">Loan</option>
          <option value="credit">Credit Card</option>
          <option value="mortgage">Mortgage</option>
        </select>
      </Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => {
          onSave({ name: f.name.trim(), balance: Number(f.balance), rate: Number(f.rate) || 0, minPayment: Number(f.minPayment) || 0, type: f.type })
        }}>Save</button>
      </div>
    </Modal>
  )
}

// ── Bill ─────────────────────────────────────────────────────────────────────

export function BillModal({ onClose, onSave, categories }) {
  const expenseCats = categories.filter(c => c.id !== 'income')
  const [f, sf] = useState({ name: '', amount: '', dueDay: '1', categoryId: expenseCats[0]?.id })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = f.name.trim() && Number(f.amount) > 0

  return (
    <Modal title="Add Bill / Subscription" onClose={onClose} accent={T.finance}>
      <Field label="Name"><input style={S.input} placeholder="e.g. Internet" value={f.name} onChange={upd('name')} /></Field>
      <Field label="Monthly Amount"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.amount} onChange={upd('amount')} /></Field>
      <Field label="Due Day (1–31)"><input style={S.inputMono} type="number" min="1" max="31" value={f.dueDay} onChange={upd('dueDay')} /></Field>
      <Field label="Category">
        <select style={selectStyle} value={f.categoryId} onChange={upd('categoryId')}>
          {expenseCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => {
          onSave({ name: f.name.trim(), amount: Number(f.amount), dueDay: Math.min(31, Math.max(1, Number(f.dueDay) || 1)), categoryId: f.categoryId })
        }}>Save</button>
      </div>
    </Modal>
  )
}

// ── Asset ────────────────────────────────────────────────────────────────────

export function AssetModal({ onClose, onSave }) {
  const [f, sf] = useState({ name: '', value: '' })
  const upd = k => e => sf(p => ({ ...p, [k]: e.target.value }))
  const valid = f.name.trim() && Number(f.value) > 0

  return (
    <Modal title="Add Asset" onClose={onClose} accent={T.finance}>
      <Field label="Name"><input style={S.input} placeholder="e.g. Savings Account" value={f.name} onChange={upd('name')} /></Field>
      <Field label="Value"><input style={S.inputMono} type="number" inputMode="decimal" placeholder="0.00" value={f.value} onChange={upd('value')} /></Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => onSave({ name: f.name.trim(), value: Number(f.value) })}>Save</button>
      </div>
    </Modal>
  )
}

// ── Category (new — lets custom categories get a stable id from creation) ──

const CAT_COLORS = ['#06c6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#94a3b8']

export function CategoryModal({ onClose, onSave }) {
  const [f, sf] = useState({ name: '', color: CAT_COLORS[0] })
  const valid = f.name.trim().length > 0

  return (
    <Modal title="Add Category" onClose={onClose} accent={T.finance}>
      <Field label="Name"><input style={S.input} placeholder="e.g. Petcare" value={f.name} onChange={e => sf(p => ({ ...p, name: e.target.value }))} /></Field>
      <Field label="Color">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {CAT_COLORS.map(c => (
            <div key={c} onClick={() => sf(p => ({ ...p, color: c }))} style={{
              width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
              border: `3px solid ${f.color === c ? T.text : 'transparent'}`,
            }} />
          ))}
        </div>
      </Field>
      <div style={btnRow}>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={{ ...btnPrimary(), opacity: valid ? 1 : 0.5 }} disabled={!valid} onClick={() => onSave({ name: f.name.trim(), color: f.color })}>Save</button>
      </div>
    </Modal>
  )
}
