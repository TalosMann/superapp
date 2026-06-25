/**
 * LockScreen.jsx — App-wide gate, rendered by App.jsx before any module
 * mounts. No biometric (deferred — see Stage 6 changelog for why). Native
 * only; web/dev bypasses this entirely upstream in App.jsx.
 *
 * States:
 *   'checking'  — running ensureEncryptedStorage() (fast no-op after first
 *                 successful run; only does real work once, ever)
 *   'error'     — migration failed; old data is untouched, offers retry
 *   'setup'     — no PIN exists yet (first run after migration) — create one
 *   'locked'    — PIN exists — enter it
 *   (unlocked — this component stops rendering, App.jsx shows the real app)
 */

import { useState, useEffect, useCallback } from 'react'
import { T } from './theme.js'
import { ensureEncryptedStorage } from './migration.js'
import { hasPinSet, setupPin, verifyPin } from './pinAuth.js'

// ── PIN Pad ────────────────────────────────────────────────────────────────

function PinPad({ value, onChange, maxLen = 6 }) {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 32 }}>
        {Array.from({ length: maxLen }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < value.length ? T.accent : 'transparent',
            border: `2px solid ${i < value.length ? T.accent : T.border}`,
            transition: 'all .15s',
          }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 280, margin: '0 auto' }}>
        {digits.map((d, i) => (
          <button key={i} onClick={() => {
            if (d === '') return
            if (d === '⌫') { onChange(value.slice(0, -1)); return }
            if (value.length < maxLen) onChange(value + d)
          }} style={{
            background: d === '' ? 'transparent' : T.bg2,
            border: d === '' ? 'none' : `1px solid ${T.border}`,
            borderRadius: 14, color: d === '⌫' ? T.text3 : T.text,
            fontSize: d === '⌫' ? 20 : 22, fontWeight: 500, height: 72,
            cursor: d === '' ? 'default' : 'pointer', fontFamily: 'inherit',
          }}>{d}</button>
        ))}
      </div>
    </div>
  )
}

// ── Setup (first run) ────────────────────────────────────────────────────────

function SetupPIN({ onDone }) {
  const [step, setStep] = useState('create')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [err, setErr] = useState('')

  async function handleFirst(pin) {
    setFirst(pin)
    if (pin.length === 6) setStep('confirm')
  }

  async function handleSecond(pin) {
    setSecond(pin)
    if (pin.length === 6) {
      if (pin !== first) {
        setErr("PINs don't match — try again")
        setFirst(''); setSecond(''); setStep('create')
        return
      }
      await setupPin(pin)
      onDone()
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>
        {step === 'create' ? 'Create a 6-digit PIN' : 'Confirm your PIN'}
      </div>
      <div style={{ fontSize: 13, color: T.text3, marginBottom: 32 }}>
        {step === 'create' ? 'This protects access to your data on this device' : 'Enter the same PIN again'}
      </div>
      {err && <div style={{ fontSize: 13, color: T.bad, marginBottom: 16 }}>{err}</div>}
      <PinPad value={step === 'create' ? first : second} onChange={step === 'create' ? handleFirst : handleSecond} />
    </div>
  )
}

// ── Entry (unlock) ───────────────────────────────────────────────────────────

function PINEntry({ onSuccess }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [shake, setShake] = useState(false)

  async function handlePin(p) {
    setPin(p)
    if (p.length === 6) {
      const ok = await verifyPin(p)
      if (ok) {
        onSuccess()
      } else {
        setShake(true)
        setTimeout(() => { setShake(false); setPin(''); setErr('Incorrect PIN') }, 500)
      }
    }
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: T.text, marginBottom: 8 }}>Enter PIN</div>
      <div style={{ fontSize: 13, color: T.text3, marginBottom: 32 }}>Enter your 6-digit PIN to unlock</div>
      {err && <div style={{ fontSize: 13, color: T.bad, marginBottom: 12 }}>{err}</div>}
      <div style={{ animation: shake ? 'pinshake .5s' : undefined }}>
        <PinPad value={pin} onChange={handlePin} />
      </div>
      <style>{`@keyframes pinshake {
        0%,100% { transform: translateX(0) } 20% { transform: translateX(-10px) }
        40% { transform: translateX(10px) } 60% { transform: translateX(-8px) } 80% { transform: translateX(8px) }
      }`}</style>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function LockScreen({ onUnlock }) {
  const [mode, setMode] = useState('checking')
  const [statusMsg, setStatusMsg] = useState('Starting up…')
  const [error, setError] = useState(null)

  const runStartup = useCallback(async () => {
    setMode('checking')
    setError(null)
    const result = await ensureEncryptedStorage(setStatusMsg)
    if (result.status === 'error') {
      setError(result.error)
      setMode('error')
      return
    }
    const exists = await hasPinSet()
    setMode(exists ? 'locked' : 'setup')
  }, [])

  useEffect(() => { runStartup() }, [runStartup])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: T.bg,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: '0 32px',
    }}>
      <div style={{ marginBottom: 48, textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, background: T.accent, borderRadius: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, margin: '0 auto 16px',
        }}>🔒</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Personal</div>
      </div>

      {mode === 'checking' && (
        <div style={{ textAlign: 'center', color: T.text3 }}>
          <div style={{ fontSize: 14 }}>{statusMsg}</div>
        </div>
      )}

      {mode === 'error' && (
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.bad, marginBottom: 10 }}>Setup failed</div>
          <div style={{ fontSize: 13, color: T.text3, marginBottom: 6, lineHeight: 1.5 }}>
            Your existing data is untouched — nothing was lost. Setting up secure
            storage hit an error:
          </div>
          <div style={{ fontSize: 12, color: T.text4, marginBottom: 24, fontFamily: 'monospace', wordBreak: 'break-word' }}>
            {error}
          </div>
          <button onClick={runStartup} style={{
            background: T.accent, border: 'none', borderRadius: 10,
            padding: '12px 24px', color: '#0a0e15', fontSize: 14, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Retry</button>
        </div>
      )}

      {mode === 'setup' && <SetupPIN onDone={onUnlock} />}
      {mode === 'locked' && <PINEntry onSuccess={onUnlock} />}
    </div>
  )
}
