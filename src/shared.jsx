/**
 * shared.jsx — Reusable UI primitives used across modules.
 */

import { T, S } from './theme.js'
import Icon from './Icon.jsx'

// ── Modal wrapper ────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, accent = T.accent }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg2, borderTop: `2px solid ${accent}`,
        borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520,
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'slideUp .25s ease-out',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', padding: '16px 16px 8px',
          gap: 8, flexShrink: 0,
        }}>
          <div style={{ flex: 1, fontSize: 18, fontWeight: 700, color: T.text }}>{title}</div>
          <button style={S.iconBtn} onClick={onClose}><Icon name="close" /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}

// ── Toggle switch ────────────────────────────────────────────────────────────

export function Toggle({ on, onChange, color = T.accent }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
      position: 'relative', flexShrink: 0, transition: 'background .2s',
      background: on ? color : T.border,
    }}>
      <div style={{
        position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
        background: '#fff', transition: 'transform .2s',
        transform: on ? 'translateX(20px)' : 'translateX(2px)',
      }} />
    </button>
  )
}

// ── Progress bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, max = 100, color = T.accent, height = 8, bg = T.bg }) {
  const p = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div style={{ height, background: bg, borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${p}%`, background: color,
        transition: 'width .4s ease', borderRadius: height / 2,
      }} />
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function EmptyState({ icon = 'star', title, hint }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: 10,
    }}>
      <div style={{ color: T.text4 }}><Icon name={icon} size={48} stroke={1.5} /></div>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text3 }}>{title}</div>
      {hint && <div style={{ fontSize: 13, color: T.text4, textAlign: 'center' }}>{hint}</div>}
    </div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

export function Stat({ label, value, sub, color = T.text }) {
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: 12, flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: T.text2, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Inline confirm dialog ────────────────────────────────────────────────────

export function Confirm({ title, message, onConfirm, onCancel, danger = true, confirmLabel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ background: T.bg2, borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 10 }}>{title}</div>
        <div style={{ fontSize: 14, color: T.text2, marginBottom: 20, lineHeight: 1.5 }}>{message}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10,
            padding: 12, color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, background: danger ? T.bad : T.accent, border: 'none', borderRadius: 10,
            padding: 12, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>{confirmLabel || (danger ? 'Delete' : 'Confirm')}</button>
        </div>
      </div>
    </div>
  )
}
