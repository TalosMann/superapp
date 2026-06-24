/**
 * data.js — Finance module constants and calculation helpers.
 *
 * Data model (single FIN_DATA blob, see storage.js KEYS.FIN_DATA):
 *   transactions: [{ id, date, desc, amount, type:'income'|'expense', categoryId, tags }]
 *   budgets:      [{ id, categoryId, limit, period:'monthly', rollover:false }]
 *   savings:      [{ id, name, target, current, deadline, color, monthlyContrib }]
 *   debts:        [{ id, name, balance, rate, minPayment, type }]
 *   bills:        [{ id, name, amount, dueDay, categoryId }]
 *   assets:       [{ id, name, value }]
 *   categories:   [{ id, name, color, builtin }]   — single list, built-ins + custom
 *   settings:     { currency: 'USD' }
 *   alerts:       { firedBudget: [string], firedSavings: [string] }  — persisted dedup
 *
 * Categories are referenced everywhere by stable `id`, never by name — renaming
 * a category doesn't break budgets/bills/transactions that point at it.
 * "Income" is a real category like any other (id: 'income'), not a special case,
 * so a transaction's type ('income'/'expense') and its categoryId are independent.
 */

import { uid } from '../../utils.js'

export const SYMS = { USD: '$', CNY: '¥', EUR: '€', GBP: '£', JPY: '¥' }
export const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export const BUILTIN_CATEGORIES = [
  { id: 'income',        name: 'Income',         color: '#10b981', builtin: true },
  { id: 'food',           name: 'Food & Dining',  color: '#f59e0b', builtin: true },
  { id: 'transport',      name: 'Transport',      color: '#06c6d4', builtin: true },
  { id: 'housing',        name: 'Housing',        color: '#8b5cf6', builtin: true },
  { id: 'entertainment',  name: 'Entertainment',  color: '#f43f5e', builtin: true },
  { id: 'shopping',       name: 'Shopping',        color: '#ec4899', builtin: true },
  { id: 'health',         name: 'Health',          color: '#10b981', builtin: true },
  { id: 'utilities',      name: 'Utilities',       color: '#6366f1', builtin: true },
  { id: 'education',      name: 'Education',       color: '#14b8a6', builtin: true },
  { id: 'other',          name: 'Other',           color: '#94a3b8', builtin: true },
]

export function categoryById(categories, id) {
  return categories.find(c => c.id === id) || { id, name: 'Unknown', color: '#94a3b8' }
}

export function newCustomCategory(name, color) {
  return { id: uid('cat'), name, color, builtin: false }
}

// ── Seed data (first-launch only — fresh install, no migration needed) ──────

const NOW = new Date()
const CY = NOW.getFullYear()
const CM = NOW.getMonth()
const mkDate = (y, m, d) => new Date(y, m, d).toISOString().split('T')[0]

export function buildSeedData() {
  return {
    transactions: [
      tx(mkDate(CY,CM,1), 'Monthly Salary', 8000, 'income', 'income', ['salary']),
      tx(mkDate(CY,CM,2), 'Rent Payment', 2200, 'expense', 'housing', ['monthly']),
      tx(mkDate(CY,CM,3), 'Grocery Store', 115, 'expense', 'food', []),
      tx(mkDate(CY,CM,5), 'Metro Card', 30, 'expense', 'transport', []),
      tx(mkDate(CY,CM,6), 'Netflix', 15.99, 'expense', 'entertainment', ['subscription']),
      tx(mkDate(CY,CM,7), 'Freelance Design', 1500, 'income', 'income', ['freelance']),
      tx(mkDate(CY,CM-1,1), 'Monthly Salary', 8000, 'income', 'income', ['salary']),
      tx(mkDate(CY,CM-1,2), 'Rent Payment', 2200, 'expense', 'housing', ['monthly']),
      tx(mkDate(CY,CM-1,5), 'Grocery Store', 132, 'expense', 'food', []),
      tx(mkDate(CY,CM-2,1), 'Monthly Salary', 8000, 'income', 'income', ['salary']),
      tx(mkDate(CY,CM-2,2), 'Rent Payment', 2200, 'expense', 'housing', ['monthly']),
    ],
    budgets: [
      { id: uid('bud'), categoryId: 'food', limit: 400, period: 'monthly', rollover: false },
      { id: uid('bud'), categoryId: 'transport', limit: 150, period: 'monthly', rollover: false },
      { id: uid('bud'), categoryId: 'housing', limit: 2300, period: 'monthly', rollover: false },
      { id: uid('bud'), categoryId: 'entertainment', limit: 100, period: 'monthly', rollover: false },
    ],
    savings: [
      { id: uid('sav'), name: 'Emergency Fund', target: 20000, current: 8500, deadline: mkDate(CY+1,0,1), color: '#06c6d4', monthlyContrib: 500 },
    ],
    debts: [
      { id: uid('debt'), name: 'Credit Card', balance: 2300, rate: 19.99, minPayment: 100, type: 'credit' },
    ],
    bills: [
      { id: uid('bill'), name: 'Rent', amount: 2200, dueDay: 1, categoryId: 'housing' },
      { id: uid('bill'), name: 'Netflix', amount: 15.99, dueDay: 6, categoryId: 'entertainment' },
    ],
    assets: [
      { id: uid('asset'), name: 'Savings Account', value: 15000 },
    ],
    categories: BUILTIN_CATEGORIES.map(c => ({ ...c })),
    settings: { currency: 'USD', translateEnabled: false, translateApiKey: '' },
    alerts: { firedBudget: [], firedSavings: [] },
  }
}

function tx(date, desc, amount, type, categoryId, tags) {
  return { id: uid('tx'), date, desc, amount, type, categoryId, tags }
}

// ── Formatting ────────────────────────────────────────────────────────────

export function makeFormatter(currency) {
  const sym = SYMS[currency] || '$'
  const fmt = n => `${sym}${Number(n || 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtShort = n => Math.abs(n) >= 10000
    ? `${n < 0 ? '-' : ''}${sym}${(Math.abs(n) / 1000).toFixed(1)}k`
    : fmt(n)
  return { sym, fmt, fmtShort }
}

// ── Derived calculations ──────────────────────────────────────────────────

export function currentMonthTx(transactions, now = new Date()) {
  return transactions.filter(t => {
    const d = new Date(t.date + 'T12:00:00')
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
}

export function sumByType(txs, type) {
  return txs.filter(t => t.type === type).reduce((s, t) => s + t.amount, 0)
}

export function catSpending(txs, categories) {
  const m = {}
  txs.filter(t => t.type === 'expense').forEach(t => { m[t.categoryId] = (m[t.categoryId] || 0) + t.amount })
  return Object.entries(m)
    .map(([categoryId, value]) => ({ categoryId, value, cat: categoryById(categories, categoryId) }))
    .sort((a, b) => b.value - a.value)
}

export function trendData3mo(transactions, now = new Date()) {
  const out = []
  for (let i = 2; i >= 0; i--) {
    const m = now.getMonth() - i
    const y = now.getFullYear() + Math.floor(m / 12)
    const mm = ((m % 12) + 12) % 12
    const txs = transactions.filter(t => {
      const d = new Date(t.date + 'T12:00:00')
      return d.getFullYear() === y && d.getMonth() === mm
    })
    out.push({
      month: MO[mm],
      income: sumByType(txs, 'income'),
      expenses: sumByType(txs, 'expense'),
    })
  }
  return out
}

export function budgetHealth(budgets, currentTx, categories) {
  return budgets.map(b => {
    const spent = currentTx
      .filter(t => t.type === 'expense' && t.categoryId === b.categoryId)
      .reduce((s, t) => s + t.amount, 0)
    return {
      ...b,
      cat: categoryById(categories, b.categoryId),
      spent,
      pct: b.limit > 0 ? Math.min((spent / b.limit) * 100, 100) : 0,
    }
  })
}

// ── Bills: real days-in-month math (fixes the old "assume 30 days" bug) ────

function daysInMonth(year, monthIdx) {
  return new Date(year, monthIdx + 1, 0).getDate()
}

/**
 * Days until a bill's due day, correctly handling month lengths (28–31 days)
 * and rolling into next month if this month's due day has passed.
 * Returns { daysUntil, isPast: false } always — "isPast" from the old code
 * doesn't really apply once we roll over properly, kept for UI compatibility
 * but always false now (a bill always has a next occurrence).
 */
export function billDueInfo(dueDay, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate()
  const thisMonthLen = daysInMonth(y, m)
  const clampedThis = Math.min(dueDay, thisMonthLen)

  if (clampedThis >= d) {
    return { daysUntil: clampedThis - d, isPast: false }
  }

  // Due day already passed this month — roll into next month, using NEXT
  // month's actual length (handles Jan 31 -> Feb 28/29 correctly).
  const nextMonthLen = daysInMonth(y, (m + 1) % 12)
  const clampedNext = Math.min(dueDay, nextMonthLen)
  return { daysUntil: (thisMonthLen - d) + clampedNext, isPast: false }
}

export function billsWithDueInfo(bills, today = new Date()) {
  return bills
    .map(b => ({ ...b, ...billDueInfo(b.dueDay, today) }))
    .sort((a, b) => a.daysUntil - b.daysUntil)
}

// ── Debt payoff calculator (avalanche / snowball) ───────────────────────────

export function calcPayoff(debts, strategy, extraPerMonth) {
  const ordered = strategy === 'avalanche'
    ? [...debts].sort((a, b) => b.rate - a.rate)
    : [...debts].sort((a, b) => a.balance - b.balance)

  let months = 0, interest = 0
  const bal = ordered.map(d => ({ ...d }))

  while (bal.some(d => d.balance > 0) && months < 360) {
    months++
    let avail = Number(extraPerMonth) || 0
    bal.forEach((d, i) => {
      if (d.balance <= 0) return
      const int = d.balance * (d.rate / 100 / 12)
      interest += int
      const pay = Math.min(d.balance + int, d.minPayment + (i === 0 ? avail : 0))
      d.balance = Math.max(0, d.balance + int - pay)
      if (d.balance === 0) avail += ordered[i].minPayment
    })
  }
  return { months, interest }
}

// ── Savings ETA ──────────────────────────────────────────────────────────

export function savingsEta(saving) {
  const remaining = saving.target - saving.current
  if (saving.monthlyContrib > 0 && remaining > 0) {
    return Math.ceil(remaining / saving.monthlyContrib)
  }
  return null
}

export function savingsPct(saving) {
  return Math.min((saving.current / saving.target) * 100, 100)
}

// ── CSV export ──────────────────────────────────────────────────────────────

export function transactionsToCsv(transactions, categories) {
  const rows = [
    ['Date', 'Description', 'Category', 'Type', 'Amount', 'Tags'],
    ...transactions.map(t => [
      t.date,
      `"${(t.desc || '').replace(/"/g, '""')}"`,
      categoryById(categories, t.categoryId).name,
      t.type,
      t.amount,
      (t.tags || []).join(';'),
    ]),
  ]
  return rows.map(r => r.join(',')).join('\n')
}
