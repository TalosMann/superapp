/**
 * Finance.jsx — Module root for Finance (Stage 5).
 *
 * Port of the standalone TalosFinance app into Personal's shell. Differences
 * from the original, all deliberate:
 *
 *   - Single FIN_DATA blob via Personal's existing storage.js (no separate
 *     SQLite database, no own encryption — Personal's storage layer handles
 *     persistence; real encryption lands app-wide in Stage 6).
 *   - No standalone lock screen / PIN / biometric — dropped entirely, Stage 6
 *     will add device-wide lock that covers every module at once.
 *   - Categories are a single list of { id, name, color, builtin }, referenced
 *     everywhere by id. The original matched by category name string, which
 *     breaks the moment a category is renamed.
 *   - IDs use Personal's uid() (collision-safe across reloads), not the
 *     original's in-memory incrementing counter (which reset to the same
 *     range every cold start — an active bug with backup/restore).
 *   - "Goals" (savings) renamed to "Savings" to avoid colliding with
 *     Personal's own Goals module (daily/weekly/monthly tiers) in the bottom nav.
 *   - Own JSON export/import dropped — Personal's unified backup (Home →
 *     Settings) already covers Finance's data. CSV transaction export kept,
 *     routed through Personal's Android-safe write path (backup.js).
 *   - Budget-alert / savings-milestone "already fired" state is persisted in
 *     FIN_DATA.alerts instead of an in-memory Set, so it survives app
 *     restarts (the original re-fired every cold start if already over
 *     threshold).
 *   - Bill due-day math accounts for actual month length (28–31 days)
 *     instead of assuming every month has 30 days.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { T, S } from '../../theme.js'
import { Confirm, EmptyState } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { fmtDate, uid } from '../../utils.js'
import { loadJSON, saveJSON, KEYS } from '../../storage.js'
import {
  SYMS, MO, BUILTIN_CATEGORIES, categoryById, newCustomCategory, buildSeedData,
  makeFormatter, currentMonthTx, sumByType, catSpending, trendData3mo,
  budgetHealth, billsWithDueInfo, transactionsToCsv,
} from './data.js'
import { requestNotificationPermission, syncBillReminders, checkBudgetAlerts, checkSavingsMilestones } from './notifications.js'
import { exportNative } from '../../backup.js'
import { importAlipayFile } from './importAlipay.js'
import { retranslateAlipayTransactions } from './translateAlipay.js'
import { testApiKey } from './translateApi.js'
import { Capacitor } from '@capacitor/core'
import {
  TxModal, BudgetModal, SavingsModal, ContribModal, DebtModal, BillModal, AssetModal, CategoryModal,
} from './FinanceModals.jsx'
import { SavingsView, DebtView } from './SavingsDebt.jsx'

const TABS = [
  { id: 'dashboard',    label: 'Dashboard' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'budgets',      label: 'Budgets' },
  { id: 'income',       label: 'Income' },
  { id: 'reports',      label: 'Reports' },
  { id: 'savings',      label: 'Savings' },
  { id: 'debt',         label: 'Debt' },
  { id: 'bills',        label: 'Bills' },
  { id: 'settings',     label: 'Settings' },
]

export default function Finance() {
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [modal, setModal] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null) // { kind, id, label }

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const existing = await loadJSON(KEYS.FIN_DATA, null)
      setData(existing || buildSeedData())
      setLoaded(true)
    })()
  }, [])

  // ── Persist on every change ──────────────────────────────────────────────
  useEffect(() => { if (loaded && data) saveJSON(KEYS.FIN_DATA, data) }, [data, loaded])

  // ── Bill reminders — resync whenever bills change ───────────────────────
  useEffect(() => {
    if (!loaded || !data) return
    requestNotificationPermission()
    syncBillReminders(data.bills)
  }, [loaded, data?.bills])

  // ── Persisted-dedup budget alerts ────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !data) return
    ;(async () => {
      const currentTx = currentMonthTx(data.transactions)
      const health = budgetHealth(data.budgets, currentTx, data.categories)
      const updated = await checkBudgetAlerts(health, data.alerts)
      if (updated !== data.alerts) setData(d => ({ ...d, alerts: updated }))
    })()
  }, [loaded, data?.transactions, data?.budgets])

  // ── Persisted-dedup savings milestones ───────────────────────────────────
  useEffect(() => {
    if (!loaded || !data) return
    ;(async () => {
      const updated = await checkSavingsMilestones(data.savings, data.alerts)
      if (updated !== data.alerts) setData(d => ({ ...d, alerts: updated }))
    })()
  }, [loaded, data?.savings])

  // ── Derived ──────────────────────────────────────────────────────────────
  const categories = data?.categories || BUILTIN_CATEGORIES
  const { fmt, fmtShort } = useMemo(() => makeFormatter(data?.settings?.currency || 'USD'), [data?.settings?.currency])

  const currentTx = useMemo(() => currentMonthTx(data?.transactions || []), [data?.transactions])
  const monthlyIncome = useMemo(() => sumByType(currentTx, 'income'), [currentTx])
  const monthlyExpenses = useMemo(() => sumByType(currentTx, 'expense'), [currentTx])
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome * 100) : 0
  const totalAssets = (data?.assets || []).reduce((s, a) => s + a.value, 0)
  const totalDebts = (data?.debts || []).reduce((s, d) => s + d.balance, 0)
  const netWorth = totalAssets - totalDebts

  const catSpendingArr = useMemo(() => catSpending(currentTx, categories), [currentTx, categories])
  const trendDataArr = useMemo(() => trendData3mo(data?.transactions || []), [data?.transactions])
  const budgetHealthArr = useMemo(() => budgetHealth(data?.budgets || [], currentTx, categories), [data?.budgets, currentTx, categories])
  const recentTx = useMemo(() =>
    [...(data?.transactions || [])].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)
  , [data?.transactions])
  const billsArr = useMemo(() => billsWithDueInfo(data?.bills || []), [data?.bills])

  // ── Mutations ────────────────────────────────────────────────────────────
  const upd = (k, v) => setData(d => ({ ...d, [k]: v }))

  const addTx = tx => upd('transactions', [...data.transactions, { ...tx, id: uid('tx') }])
  const updateTx = (id, patch) => upd('transactions', data.transactions.map(t => t.id === id ? { ...t, ...patch } : t))
  const delTx = id => upd('transactions', data.transactions.filter(t => t.id !== id))
  const addBudget = b => upd('budgets', [...data.budgets, { ...b, id: uid('bud') }])
  const delBudget = id => upd('budgets', data.budgets.filter(b => b.id !== id))
  const addSaving = s => upd('savings', [...data.savings, { ...s, id: uid('sav'), current: 0 }])
  const delSaving = id => upd('savings', data.savings.filter(s => s.id !== id))
  const contribSaving = (id, amt) => upd('savings', data.savings.map(s =>
    s.id === id ? { ...s, current: Math.min(s.current + amt, s.target) } : s))
  const addDebt = d => upd('debts', [...data.debts, { ...d, id: uid('debt') }])
  const delDebt = id => upd('debts', data.debts.filter(d => d.id !== id))
  const addBill = b => upd('bills', [...data.bills, { ...b, id: uid('bill') }])
  const delBill = id => upd('bills', data.bills.filter(b => b.id !== id))
  const addAsset = a => upd('assets', [...data.assets, { ...a, id: uid('asset') }])
  const delAsset = id => upd('assets', data.assets.filter(a => a.id !== id))
  const addCategory = c => upd('categories', [...data.categories, newCustomCategory(c.name, c.color)])
  const delCategory = id => upd('categories', data.categories.filter(c => c.id !== id))
  const setCurrency = currency => upd('settings', { ...data.settings, currency })
  const setTranslateSettings = patch => upd('settings', { ...data.settings, ...patch })

  async function handleImportAlipay(file) {
    const translateOptions = { enabled: data.settings.translateEnabled, apiKey: data.settings.translateApiKey }
    const { newCategories, toInsert, skipped, totalParsed, apiTranslated } = await importAlipayFile(file, data.categories, data.transactions, translateOptions)
    setData(d => ({
      ...d,
      categories: [...d.categories, ...newCategories],
      transactions: [...d.transactions, ...toInsert],
    }))
    return { added: toInsert.length, skipped, totalParsed, newCategories: newCategories.length, apiTranslated }
  }

  async function handleRetranslate() {
    const translateOptions = { enabled: data.settings.translateEnabled, apiKey: data.settings.translateApiKey }
    const { updated, changed } = await retranslateAlipayTransactions(data.transactions, translateOptions)
    if (changed > 0) upd('transactions', updated)
    return changed
  }

  function clearData(scope) {
    const today = new Date().toISOString().split('T')[0]
    if (scope === 'hour') {
      upd('transactions', data.transactions.filter(t => t.date !== today))
    } else if (scope === 'week') {
      const c = new Date(); c.setDate(c.getDate() - 7)
      const cs = c.toISOString().split('T')[0]
      upd('transactions', data.transactions.filter(t => t.date < cs))
    } else if (scope === 'month') {
      const c = new Date(); c.setDate(c.getDate() - 30)
      const cs = c.toISOString().split('T')[0]
      upd('transactions', data.transactions.filter(t => t.date < cs))
    } else if (scope === 'all') {
      setData(d => ({
        ...d,
        transactions: [], budgets: [], savings: [], debts: [], bills: [], assets: [],
        alerts: { firedBudget: [], firedSavings: [] },
      }))
    }
  }

  function requestDelete(kind, id, label) {
    setConfirmDel({ kind, id, label })
  }

  function confirmDelete() {
    const { kind, id } = confirmDel
    if (kind === 'tx') delTx(id)
    if (kind === 'budget') delBudget(id)
    if (kind === 'saving') delSaving(id)
    if (kind === 'debt') delDebt(id)
    if (kind === 'bill') delBill(id)
    if (kind === 'asset') delAsset(id)
    if (kind === 'category') delCategory(id)
    setConfirmDel(null)
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (!loaded || !data) {
    return (
      <div style={S.screen}>
        <div style={S.header}><div style={S.headerTitle}>Finance</div></div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text3 }}>Loading…</div>
      </div>
    )
  }

  const activeLabel = TABS.find(t => t.id === tab)?.label

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>{activeLabel}</div>
      </div>

      {/* Sub-tab strip */}
      <div style={{
        display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto',
        flexShrink: 0, WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '7px 13px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            background: tab === t.id ? `${T.finance}22` : 'transparent',
            color: tab === t.id ? T.finance : T.text4,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
        {tab === 'dashboard' && (
          <Dashboard fmt={fmt} fmtShort={fmtShort} netWorth={netWorth} totalAssets={totalAssets}
            totalDebts={totalDebts} monthlyIncome={monthlyIncome} monthlyExpenses={monthlyExpenses}
            savingsRate={savingsRate} budgetHealthArr={budgetHealthArr} catSpendingArr={catSpendingArr}
            trendDataArr={trendDataArr} recentTx={recentTx} />
        )}
        {tab === 'transactions' && (
          <Transactions txs={data.transactions} categories={categories} fmt={fmt}
            onAdd={() => setModal('tx')} onEdit={t => setModal({ type: 'editTx', tx: t })}
            onDelete={t => requestDelete('tx', t.id, t.desc)} />
        )}
        {tab === 'budgets' && (
          <Budgets budgetHealthArr={budgetHealthArr} fmt={fmt}
            onAdd={() => setModal('budget')} onDelete={b => requestDelete('budget', b.id, b.cat.name)} />
        )}
        {tab === 'income' && (
          <Income transactions={data.transactions} trendDataArr={trendDataArr} fmt={fmt} />
        )}
        {tab === 'reports' && (
          <Reports transactions={data.transactions} categories={categories} fmt={fmt} />
        )}
        {tab === 'savings' && (
          <SavingsView savings={data.savings} fmt={fmt}
            onAdd={() => setModal('saving')}
            onDelete={s => requestDelete('saving', s.id, s.name)}
            onContrib={s => setModal({ type: 'contrib', saving: s })} />
        )}
        {tab === 'debt' && (
          <DebtView debts={data.debts} fmt={fmt}
            onAdd={() => setModal('debt')} onDelete={d => requestDelete('debt', d.id, d.name)} />
        )}
        {tab === 'bills' && (
          <Bills bills={billsArr} fmt={fmt} onAdd={() => setModal('bill')}
            onDelete={b => requestDelete('bill', b.id, b.name)} />
        )}
        {tab === 'settings' && (
          <SettingsTab data={data} categories={categories} fmt={fmt} totalAssets={totalAssets}
            onAddAsset={() => setModal('asset')} onDeleteAsset={a => requestDelete('asset', a.id, a.name)}
            onAddCategory={() => setModal('category')} onDeleteCategory={c => requestDelete('category', c.id, c.name)}
            onSetCurrency={setCurrency} onClear={clearData} onImportAlipay={handleImportAlipay} onRetranslate={handleRetranslate}
            onSetTranslateSettings={setTranslateSettings} />
        )}
      </div>

      {/* Modals */}
      {modal === 'tx' && <TxModal categories={categories} onClose={() => setModal(null)} onSave={tx => { addTx(tx); setModal(null) }} />}
      {modal?.type === 'editTx' && <TxModal categories={categories} editing={modal.tx} onClose={() => setModal(null)} onSave={patch => { updateTx(modal.tx.id, patch); setModal(null) }} />}
      {modal === 'budget' && <BudgetModal categories={categories} onClose={() => setModal(null)} onSave={b => { addBudget(b); setModal(null) }} />}
      {modal === 'saving' && <SavingsModal onClose={() => setModal(null)} onSave={s => { addSaving(s); setModal(null) }} />}
      {modal?.type === 'contrib' && <ContribModal saving={modal.saving} fmt={fmt} onClose={() => setModal(null)} onSave={amt => { contribSaving(modal.saving.id, amt); setModal(null) }} />}
      {modal === 'debt' && <DebtModal onClose={() => setModal(null)} onSave={d => { addDebt(d); setModal(null) }} />}
      {modal === 'bill' && <BillModal categories={categories} onClose={() => setModal(null)} onSave={b => { addBill(b); setModal(null) }} />}
      {modal === 'asset' && <AssetModal onClose={() => setModal(null)} onSave={a => { addAsset(a); setModal(null) }} />}
      {modal === 'category' && <CategoryModal onClose={() => setModal(null)} onSave={c => { addCategory(c); setModal(null) }} />}

      {confirmDel && (
        <Confirm title="Delete this?" message={`"${confirmDel.label}" will be permanently removed.`}
          onCancel={() => setConfirmDel(null)} onConfirm={confirmDelete} />
      )}
    </div>
  )
}

// ── Shared bits ──────────────────────────────────────────────────────────────

function CatDot({ cat, size = 8 }) {
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: cat?.color || '#94a3b8', marginRight: 6, flexShrink: 0, verticalAlign: 'middle' }} />
}

function ChartTooltipBox({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 14px' }}>
      {label && <div style={{ fontSize: 12, color: T.text3, marginBottom: 6 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="mono" style={{ color: p.color || p.fill, fontSize: 13 }}>
          {p.name}: {fmt ? fmt(p.value) : p.value}
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ ...S.card, padding: 16, flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.text4, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function DeleteBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'transparent', border: 'none', color: T.text4, cursor: 'pointer',
      padding: 4, display: 'flex', alignItems: 'center',
    }}><Icon name="close" size={16} /></button>
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

// ── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ fmt, fmtShort, netWorth, totalAssets, totalDebts, monthlyIncome, monthlyExpenses, savingsRate, budgetHealthArr, catSpendingArr, trendDataArr, recentTx }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 14, marginTop: 4 }}>
        <StatCard label="Net Worth" value={fmtShort(netWorth)} sub={`Assets ${fmt(totalAssets)} · Debt ${fmt(totalDebts)}`} color={T.finance} />
        <StatCard label="Monthly Income" value={fmt(monthlyIncome)} sub="This month" color={T.good} />
        <StatCard label="Monthly Expenses" value={fmt(monthlyExpenses)} sub="This month" color={T.bad} />
        <StatCard label="Savings Rate" value={`${savingsRate.toFixed(1)}%`} sub={`${fmt(Math.max(0, monthlyIncome - monthlyExpenses))} saved`} color={T.warn} />
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 14 }}>3-Month Income vs Expenses</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={trendDataArr} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontSize: 11, fill: T.text3 }} axisLine={false} tickLine={false} />
            <YAxis stroke={T.border} tick={{ fontSize: 10, fill: T.text3 }} tickFormatter={v => `${v / 1000}k`} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<ChartTooltipBox fmt={fmt} />} />
            <Bar dataKey="income" name="Income" fill={T.good} radius={[5, 5, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill={T.bad} radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 12 }}>Spending by Category</div>
        {catSpendingArr.length > 0 ? (<>
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={catSpendingArr} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" strokeWidth={0}>
                {catSpendingArr.map((e, i) => <Cell key={i} fill={e.cat.color} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div>{catSpendingArr.slice(0, 4).map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12 }}>
              <span style={{ color: T.text3 }}><CatDot cat={c.cat} />{c.cat.name}</span>
              <span className="mono" style={{ color: T.text, fontWeight: 600 }}>{fmt(c.value)}</span>
            </div>
          ))}</div>
        </>) : <EmptyState icon="wallet" title="No expenses this month" />}
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 12 }}>Budget Health</div>
        {budgetHealthArr.length === 0 && <EmptyState icon="target" title="No budgets yet" />}
        {budgetHealthArr.map(b => (
          <div key={b.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: T.text3 }}><CatDot cat={b.cat} />{b.cat.name}</span>
              <span className="mono" style={{ color: b.pct > 90 ? T.bad : b.pct > 70 ? T.warn : T.text3, fontSize: 11 }}>{fmt(b.spent)} / {fmt(b.limit)}</span>
            </div>
            <div style={{ height: 5, background: T.bg3, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${b.pct}%`, height: 5, background: b.pct > 90 ? T.bad : b.pct > 70 ? T.warn : T.finance }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 10 }}>Recent Transactions</div>
        {recentTx.length === 0 && <EmptyState icon="wallet" title="No transactions yet" />}
        {recentTx.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{t.type === 'income' ? '💰' : '💸'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: T.text4 }}>{fmtDate(t.date)}</div>
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.type === 'income' ? T.good : T.bad, flexShrink: 0 }}>{t.type === 'income' ? '+' : '-'}{fmt(t.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Transactions ─────────────────────────────────────────────────────────────

function Transactions({ txs, categories, fmt, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [catF, setCatF] = useState('all')
  const [typeF, setTypeF] = useState('all')

  const filtered = useMemo(() => txs.filter(t => {
    if (search && !t.desc.toLowerCase().includes(search.toLowerCase())) return false
    if (catF !== 'all' && t.categoryId !== catF) return false
    if (typeF !== 'all' && t.type !== typeF) return false
    return true
  }).sort((a, b) => new Date(b.date) - new Date(a.date)), [txs, search, catF, typeF])

  const inputStyle = { background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '9px 12px', color: T.text, fontSize: 13, fontFamily: 'inherit', outline: 'none' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.text3 }}>{txs.length} records</div>
        <AddBtn onClick={onAdd} label="Add" />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={inputStyle} value={catF} onChange={e => setCatF(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={inputStyle} value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      {filtered.length === 0 && <EmptyState icon="wallet" title="No transactions found" />}
      {filtered.map(t => {
        const cat = categoryById(categories, t.categoryId)
        return (
          <div key={t.id} onClick={() => onEdit(t)} style={{ ...S.card, padding: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: T.text4, marginTop: 2 }}>
                {fmtDate(t.date)} · <CatDot cat={cat} />{cat.name}
              </div>
              {t.tags?.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {t.tags.map(tg => <span key={tg} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 5, padding: '1px 7px', fontSize: 10, color: T.text4, marginRight: 4 }}>{tg}</span>)}
                </div>
              )}
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: t.type === 'income' ? T.good : T.bad, flexShrink: 0 }}>{t.type === 'income' ? '+' : '-'}{fmt(t.amount)}</div>
            <div onClick={e => e.stopPropagation()}><DeleteBtn onClick={() => onDelete(t)} /></div>
          </div>
        )
      })}
    </div>
  )
}

// ── Budgets ──────────────────────────────────────────────────────────────────

function Budgets({ budgetHealthArr, fmt, onAdd, onDelete }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.text3 }}>Monthly tracking</div>
        <AddBtn onClick={onAdd} label="Add" />
      </div>
      {budgetHealthArr.length === 0 && <EmptyState icon="target" title="No budgets yet" hint="Add a category budget to start tracking." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {budgetHealthArr.map(b => (
          <div key={b.id} style={{ ...S.card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text3 }}><CatDot cat={b.cat} />{b.cat.name}</div>
              <DeleteBtn onClick={() => onDelete(b)} />
            </div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700, color: b.pct > 90 ? T.bad : b.pct > 70 ? T.warn : T.text }}>{fmt(b.spent)}</div>
            <div style={{ fontSize: 12, color: T.text4, marginBottom: 10 }}>of {fmt(b.limit)} budget</div>
            <div style={{ height: 7, background: T.bg3, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${b.pct}%`, height: 7, background: b.pct > 90 ? T.bad : b.pct > 70 ? T.warn : T.finance }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.text4, marginTop: 6 }}>
              <span>{b.pct.toFixed(0)}% used</span>
              <span>{fmt(Math.max(0, b.limit - b.spent))} left</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Income ───────────────────────────────────────────────────────────────────

function Income({ transactions, trendDataArr, fmt }) {
  const inc = transactions.filter(t => t.type === 'income').sort((a, b) => new Date(b.date) - new Date(a.date))
  const total = inc.reduce((s, t) => s + t.amount, 0)
  const salary = inc.filter(t => t.tags?.includes('salary')).reduce((s, t) => s + t.amount, 0)
  const other = total - salary

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 4, marginBottom: 14 }}>
        <StatCard label="Total" value={fmt(total)} color={T.good} />
        <StatCard label="Salary" value={fmt(salary)} color={T.finance} />
        <StatCard label="Other" value={fmt(other)} color={T.warn} />
      </div>
      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 14 }}>Monthly Income Trend</div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trendDataArr}>
            <defs><linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.good} stopOpacity={.25} /><stop offset="95%" stopColor={T.good} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontSize: 11, fill: T.text3 }} axisLine={false} tickLine={false} />
            <YAxis stroke={T.border} tick={{ fontSize: 10, fill: T.text3 }} tickFormatter={v => `${v / 1000}k`} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<ChartTooltipBox fmt={fmt} />} />
            <Area type="monotone" dataKey="income" name="Income" stroke={T.good} fill="url(#incGrad)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 10 }}>Income Log</div>
        {inc.length === 0 && <EmptyState icon="wallet" title="No income logged yet" />}
        {inc.slice(0, 15).map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 0', borderTop: `1px solid ${T.border}` }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{t.desc}</div>
              <div style={{ fontSize: 11, color: T.text4 }}>{fmtDate(t.date)}</div>
            </div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.good }}>+{fmt(t.amount)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Reports ──────────────────────────────────────────────────────────────────

function Reports({ transactions, categories, fmt }) {
  const [range, setRange] = useState('3m')
  const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[range]
  const cutoff = useMemo(() => { const d = new Date(); d.setMonth(d.getMonth() - months); return d }, [months])
  const filtered = useMemo(() => transactions.filter(t => new Date(t.date + 'T12:00:00') >= cutoff), [transactions, cutoff])

  const catData = useMemo(() => catSpending(filtered, categories), [filtered, categories])
  const totalSpend = catData.reduce((s, c) => s + c.value, 0)

  const monthlyData = useMemo(() => {
    const m = {}
    filtered.forEach(t => {
      const d = new Date(t.date + 'T12:00:00')
      const k = `${MO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
      if (!m[k]) m[k] = { month: k, income: 0, expenses: 0, _ts: d.getTime() }
      if (t.type === 'income') m[k].income += t.amount
      else m[k].expenses += t.amount
    })
    return Object.values(m).sort((a, b) => a._ts - b._ts)
  }, [filtered])

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginTop: 4, marginBottom: 14 }}>
        {['1m', '3m', '6m', '1y'].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
            border: `1px solid ${range === r ? T.finance : T.border}`,
            background: range === r ? `${T.finance}22` : 'transparent',
            color: range === r ? T.finance : T.text3, cursor: 'pointer', fontFamily: 'inherit',
          }}>{r.toUpperCase()}</button>
        ))}
      </div>
      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 14 }}>Monthly Trends</div>
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={monthlyData}>
            <defs>
              <linearGradient id="repInc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.good} stopOpacity={.2} /><stop offset="95%" stopColor={T.good} stopOpacity={0} /></linearGradient>
              <linearGradient id="repExp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.bad} stopOpacity={.2} /><stop offset="95%" stopColor={T.bad} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
            <XAxis dataKey="month" stroke={T.border} tick={{ fontSize: 10, fill: T.text3 }} axisLine={false} tickLine={false} />
            <YAxis stroke={T.border} tick={{ fontSize: 10, fill: T.text3 }} tickFormatter={v => `${v / 1000}k`} axisLine={false} tickLine={false} width={32} />
            <Tooltip content={<ChartTooltipBox fmt={fmt} />} />
            <Area type="monotone" dataKey="income" name="Income" stroke={T.good} fill="url(#repInc)" strokeWidth={2} />
            <Area type="monotone" dataKey="expenses" name="Expenses" stroke={T.bad} fill="url(#repExp)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...S.card, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text2, marginBottom: 12 }}>Category Breakdown</div>
        {catData.length > 0 ? (<>
          <ResponsiveContainer width="100%" height={120}>
            <PieChart>
              <Pie data={catData} cx="50%" cy="50%" outerRadius={55} dataKey="value" strokeWidth={0}>
                {catData.map((e, i) => <Cell key={i} fill={e.cat.color} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 8 }}>
            {catData.map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i ? `1px solid ${T.border}` : 'none', fontSize: 12 }}>
                <span style={{ color: T.text3 }}><CatDot cat={c.cat} />{c.cat.name}</span>
                <span className="mono" style={{ color: T.text }}>{fmt(c.value)} <span style={{ color: T.text4 }}>({totalSpend ? (c.value / totalSpend * 100).toFixed(0) : 0}%)</span></span>
              </div>
            ))}
          </div>
        </>) : <EmptyState icon="chart" title="No data for this range" />}
      </div>
    </div>
  )
}

// ── Bills ────────────────────────────────────────────────────────────────────

function Bills({ bills, fmt, onAdd, onDelete }) {
  const total = bills.reduce((s, b) => s + b.amount, 0)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.text3 }}>Monthly total: {fmt(total)}</div>
        <AddBtn onClick={onAdd} label="Add" />
      </div>
      {bills.length === 0 && <EmptyState icon="history" title="No bills yet" />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bills.map(b => {
          const urgency = b.daysUntil <= 3 ? T.bad : b.daysUntil <= 7 ? T.warn : T.finance
          return (
            <div key={b.id} style={{ ...S.card, padding: 16, borderLeft: `3px solid ${urgency}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontWeight: 700, color: T.text }}>{b.name}</div>
                <DeleteBtn onClick={() => onDelete(b)} />
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 4 }}>{fmt(b.amount)}</div>
              <div style={{ fontSize: 12, color: urgency, fontWeight: 600 }}>
                {b.daysUntil === 0 ? '⚠️ Due Today' : `Due in ${b.daysUntil} day${b.daysUntil !== 1 ? 's' : ''}`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsTab({ data, categories, fmt, totalAssets, onAddAsset, onDeleteAsset, onAddCategory, onDeleteCategory, onSetCurrency, onClear, onImportAlipay, onRetranslate, onSetTranslateSettings }) {
  const [confirmClear, setConfirmClear] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [importing, setImporting] = useState(false)
  const [retranslating, setRetranslating] = useState(false)
  const [keyInput, setKeyInput] = useState(data.settings?.translateApiKey || '')
  const [testResult, setTestResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const onNative = Capacitor.isNativePlatform()
  const translateEnabled = !!data.settings?.translateEnabled

  const clearOptions = [
    { key: 'hour', label: 'Today', desc: "Today's transactions" },
    { key: 'week', label: 'Past Week', desc: 'Last 7 days of transactions' },
    { key: 'month', label: 'Past Month', desc: 'Last 30 days of transactions' },
    { key: 'all', label: 'All Data', desc: 'Transactions, budgets, savings, debts, bills, assets' },
  ]

  function flash(text) { setMessage(text); setTimeout(() => setMessage(null), 5000) }

  async function handleAlipayFile(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset so picking the same file again still fires onChange
    if (!file) return
    setImporting(true)
    try {
      const r = await onImportAlipay(file)
      const parts = [`Imported ${r.added} new transaction${r.added !== 1 ? 's' : ''}`]
      if (r.skipped) parts.push(`skipped ${r.skipped} already imported`)
      if (r.newCategories) parts.push(`added ${r.newCategories} new categor${r.newCategories !== 1 ? 'ies' : 'y'}`)
      if (r.apiTranslated) parts.push(`${r.apiTranslated} translated via API`)
      flash(parts.join(', ') + '.')
    } catch (err) {
      flash(`Import failed: ${err.message}`)
    } finally { setImporting(false) }
  }

  async function exportCsv() {
    setBusy(true)
    try {
      const csv = transactionsToCsv(data.transactions, categories)
      const date = new Date().toISOString().split('T')[0]
      const filename = `finance-transactions-${date}.csv`

      if (onNative) {
        await exportNative(filename, csv)
      } else {
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = filename
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
      flash(`Saved ${filename}`)
    } catch (err) {
      flash(`Export failed: ${err.message}`)
    } finally { setBusy(false) }
  }

  const customCats = categories.filter(c => !c.builtin)

  return (
    <div>
      <div style={{ ...S.card, padding: 16, marginTop: 4, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: T.text2, marginBottom: 12, fontSize: 13 }}>Currency</div>
        <select value={data.settings?.currency || 'USD'} onChange={e => onSetCurrency(e.target.value)} style={{
          background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
          color: T.text, fontSize: 14, width: '100%', fontFamily: 'inherit',
        }}>
          {Object.keys(SYMS).map(c => <option key={c} value={c}>{c} ({SYMS[c]})</option>)}
        </select>
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: T.text2, marginBottom: 4, fontSize: 13 }}>Import Alipay statement</div>
        <div style={{ fontSize: 12, color: T.text4, marginBottom: 12, lineHeight: 1.4 }}>
          Upload a cashbook (记账本) CSV export from Alipay. Categories are mapped
          automatically — new ones are created if needed. Re-uploading a statement
          with overlapping dates is safe; already-imported transactions are skipped.
        </div>
        <label style={{
          display: 'block', width: '100%', textAlign: 'center', boxSizing: 'border-box',
          background: importing ? T.bg3 : T.finance, border: 'none', borderRadius: 10,
          padding: 12, color: importing ? T.text3 : '#0a0e15', fontSize: 14, fontWeight: 700,
          cursor: importing ? 'wait' : 'pointer', fontFamily: 'inherit',
        }}>
          {importing ? 'Importing…' : 'Choose CSV file'}
          <input type="file" accept=".csv,text/csv" onChange={handleAlipayFile} disabled={importing} style={{ display: 'none' }} />
        </label>
        <button disabled={retranslating} onClick={async () => {
          setRetranslating(true)
          try {
            const n = await onRetranslate()
            flash(n > 0 ? `Re-translated ${n} transaction${n !== 1 ? 's' : ''}.` : 'Everything is already translated.')
          } finally { setRetranslating(false) }
        }} style={{
          width: '100%', marginTop: 8, background: 'transparent', border: `1px solid ${T.border}`,
          borderRadius: 10, padding: 11, color: T.text2, fontSize: 13, fontWeight: 600,
          cursor: retranslating ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: retranslating ? 0.6 : 1,
        }}>{retranslating ? 'Re-translating…' : 'Re-translate imported transactions'}</button>
        {message && <div style={{ fontSize: 12, color: T.text3, marginTop: 8 }}>{message}</div>}
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <div style={{ fontWeight: 700, color: T.text2, fontSize: 13 }}>Translation (optional)</div>
          <button onClick={() => { onSetTranslateSettings({ translateEnabled: !translateEnabled }); setTestResult(null) }} style={{
            width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
            position: 'relative', flexShrink: 0, transition: 'background .2s',
            background: translateEnabled ? T.finance : T.border,
          }}>
            <div style={{
              position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
              background: '#fff', transition: 'transform .2s',
              transform: translateEnabled ? 'translateX(20px)' : 'translateX(2px)',
            }} />
          </button>
        </div>
        <div style={{ fontSize: 12, color: T.text4, marginBottom: 12, lineHeight: 1.4 }}>
          Off by default. When on, transaction descriptions still in Chinese
          after the built-in offline dictionary are sent to the Google Cloud
          Translation API to translate — and only the description text, never
          amounts, dates, or anything else. This requires your own API key
          (Google Cloud Console → enable "Cloud Translation API" → create a
          key). The free tier (500,000 characters/month) easily covers normal
          personal use. The key is stored locally on this device alongside
          the rest of your Finance data — like everything else in the app
          right now, that storage isn't encrypted yet.
        </div>
        {translateEnabled && (<>
          <input
            type="password"
            placeholder="Paste your Google Cloud API key"
            value={keyInput}
            onChange={e => { setKeyInput(e.target.value); setTestResult(null) }}
            onBlur={() => onSetTranslateSettings({ translateApiKey: keyInput })}
            style={{
              background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
              color: T.text, fontSize: 13, width: '100%', fontFamily: 'inherit', outline: 'none', marginBottom: 10,
            }}
          />
          <button disabled={testing || !keyInput} onClick={async () => {
            onSetTranslateSettings({ translateApiKey: keyInput })
            setTesting(true); setTestResult(null)
            const r = await testApiKey(keyInput)
            setTestResult(r)
            setTesting(false)
          }} style={{
            width: '100%', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10,
            padding: 10, color: T.text2, fontSize: 13, fontWeight: 600,
            cursor: testing ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: !keyInput ? 0.5 : 1,
          }}>{testing ? 'Testing…' : 'Test connection'}</button>
          {testResult && (
            <div style={{ fontSize: 12, marginTop: 8, color: testResult.ok ? T.good : T.bad, lineHeight: 1.4 }}>
              {testResult.ok ? `✓ Working — "你好" → "${testResult.sample}"` : `✗ ${testResult.error}`}
            </div>
          )}
        </>)}
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: T.text2, fontSize: 13 }}>Categories</div>
          <button onClick={onAddCategory} style={{ background: 'transparent', border: 'none', color: T.finance, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        </div>
        {categories.filter(c => c.id !== 'income').map(c => (
          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <CatDot cat={c} size={10} />
            <div style={{ flex: 1, fontSize: 13, color: T.text }}>{c.name}</div>
            {!c.builtin && <DeleteBtn onClick={() => onDeleteCategory(c)} />}
          </div>
        ))}
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: T.text2, marginBottom: 4, fontSize: 13 }}>Export transactions (CSV)</div>
        <div style={{ fontSize: 12, color: T.text4, marginBottom: 12, lineHeight: 1.4 }}>
          Full JSON backup of all modules (including Finance) is in Home → Settings.
          This exports just your transaction history as a spreadsheet-friendly CSV.
        </div>
        <button onClick={exportCsv} disabled={busy} style={{
          width: '100%', background: T.finance, border: 'none', borderRadius: 10,
          padding: 12, color: '#0a0e15', fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Working…' : 'Export CSV'}</button>
        {message && <div style={{ fontSize: 12, color: T.text3, marginTop: 8 }}>{message}</div>}
      </div>

      <div style={{ ...S.card, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, color: T.text2, fontSize: 13 }}>Assets <span className="mono" style={{ color: T.text, marginLeft: 6 }}>{fmt(totalAssets)}</span></div>
          <button onClick={onAddAsset} style={{ background: 'transparent', border: 'none', color: T.finance, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        </div>
        {data.assets.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', padding: '6px 0' }}>
            <div style={{ flex: 1, fontSize: 13, color: T.text }}>{a.name}</div>
            <div className="mono" style={{ fontSize: 13, color: T.text2, marginRight: 8 }}>{fmt(a.value)}</div>
            <DeleteBtn onClick={() => onDeleteAsset(a)} />
          </div>
        ))}
      </div>

      <div style={{ ...S.card, padding: 16, border: `1px solid ${T.bad}44` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.bad, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>⚠ Danger Zone</div>
        <div style={{ fontSize: 12, color: T.text4, marginBottom: 14 }}>Permanently delete data. This cannot be undone.</div>
        {clearOptions.map(opt => (
          <div key={opt.key} style={{ background: T.bg3, border: `1px solid ${T.bad}33`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
            <div style={{ fontWeight: 700, color: T.bad, fontSize: 13, marginBottom: 2 }}>Clear {opt.label}</div>
            <div style={{ fontSize: 11, color: T.text4, marginBottom: 10 }}>{opt.desc}</div>
            {confirmClear === opt.key ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setConfirmClear(null)} style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 7, color: T.text2, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => { onClear(opt.key); setConfirmClear(null) }} style={{ flex: 1, padding: '7px 0', fontSize: 12, background: T.bad, color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Confirm Delete</button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(opt.key)} style={{ width: '100%', padding: '8px 0', fontSize: 12, borderRadius: 7, background: 'transparent', border: `1px solid ${T.bad}`, color: T.bad, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Clear {opt.label}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
