/**
 * Home.jsx — Currently a placeholder home screen with the global settings
 * accessible (backup/restore + storage stats). The proper dashboard with
 * cross-module summaries lands in a later stage.
 */

import { useState, useEffect } from 'react'
import { T, S } from '../theme.js'
import { Confirm } from '../shared.jsx'
import Icon from '../Icon.jsx'
import { exportBackup, pickBackupFile, validateBackup, restoreBackup, getStorageStats } from '../backup.js'

export default function Home() {
  const [view, setView] = useState('home') // 'home' | 'settings'

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>{view === 'home' ? 'Personal' : 'Settings'}</div>
        {view === 'home' && (
          <button style={S.iconBtn} onClick={() => setView('settings')}>
            <Icon name="settings" size={20} />
          </button>
        )}
        {view === 'settings' && (
          <button style={S.iconBtn} onClick={() => setView('home')}>
            <Icon name="close" size={20} />
          </button>
        )}
      </div>

      {view === 'home' && <HomeView />}
      {view === 'settings' && <SettingsView />}
    </div>
  )
}

// ── Home placeholder ────────────────────────────────────────────────────────

function HomeView() {
  const today = new Date().toLocaleDateString('en', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  return (
    <div style={S.scroll}>
      <div style={{ fontSize: 13, color: T.text3, marginBottom: 4 }}>{today}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: T.text, marginBottom: 24 }}>
        Welcome back
      </div>

      <div style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 18, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ color: T.accent }}><Icon name="dashboard" size={20} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Dashboard coming soon</div>
        </div>
        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
          Once Gym, Goals, and the other modules are built, this screen will show your
          daily snapshot — calories vs target, today's timetable, gym sessions this week,
          open goals, and budget health.
        </div>
      </div>

      <div style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{ color: T.nutrition }}><Icon name="fork" size={20} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>Nutrition is live</div>
        </div>
        <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
          Tap the Nutrition tab below to log meals, track body weight, and see trends.
          Your data is saved on this device only.
        </div>
      </div>
    </div>
  )
}

// ── Settings ────────────────────────────────────────────────────────────────

function SettingsView() {
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }
  const [pendingRestore, setPendingRestore] = useState(null) // backup data awaiting confirm

  useEffect(() => { refreshStats() }, [])

  async function refreshStats() {
    setStats(await getStorageStats())
  }

  function flash(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleExport() {
    setBusy(true)
    try {
      const result = await exportBackup()
      flash('success', `Saved ${result.filename} (${formatBytes(result.size)})`)
    } catch (err) {
      flash('error', `Export failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    setBusy(true)
    try {
      const parsed = await pickBackupFile()
      if (!parsed) { setBusy(false); return }
      const v = validateBackup(parsed)
      if (!v.valid) {
        flash('error', `Invalid backup: ${v.reason}`)
        setBusy(false)
        return
      }
      // Stash it, ask for confirmation before overwriting
      setPendingRestore({ data: v.data, exportedAt: v.exportedAt })
    } catch (err) {
      flash('error', `Import failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function confirmRestore() {
    setBusy(true)
    try {
      await restoreBackup(pendingRestore.data)
      flash('success', 'Backup restored — restarting…')
      setPendingRestore(null)
      // Reload after a beat so every module re-mounts and reads fresh state
      setTimeout(() => location.reload(), 1200)
    } catch (err) {
      flash('error', `Restore failed: ${err.message}`)
      setPendingRestore(null)
      setBusy(false)
    }
  }

  return (
    <div style={S.scroll}>
      {/* Storage summary */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Storage
        </div>
        {stats ? (
          <div style={{ display: 'flex', gap: 16 }}>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{stats.keyCount}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>data keys</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{formatBytes(stats.totalBytes)}</div>
              <div style={{ fontSize: 12, color: T.text3 }}>total size</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: T.text3 }}>Loading…</div>
        )}
      </div>

      {/* Backup section */}
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 4px 8px' }}>
        Backup
      </div>

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ color: T.accent, marginTop: 2 }}><Icon name="chart" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Export everything</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              Saves a JSON file with all modules' data. Goes to Downloads on this device.
            </div>
          </div>
        </div>
        <button onClick={handleExport} disabled={busy} style={{
          width: '100%', background: T.accent, border: 'none', borderRadius: 10,
          padding: 12, color: '#031018', fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Working…' : 'Export backup'}
        </button>
      </div>

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ color: T.warn, marginTop: 2 }}><Icon name="history" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Restore from backup</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              Replaces all current data with the contents of a backup file. You'll be asked to confirm.
            </div>
          </div>
        </div>
        <button onClick={handleImport} disabled={busy} style={{
          width: '100%', background: 'transparent', border: `1px solid ${T.warn}`,
          borderRadius: 10, padding: 12, color: T.warn, fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
          opacity: busy ? 0.6 : 1,
        }}>
          {busy ? 'Working…' : 'Import backup'}
        </button>
      </div>

      {/* About */}
      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 4px 8px' }}>
        About
      </div>
      <div style={{ ...S.card, fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
        <div>Personal v0.1 (Stage 1)</div>
        <div style={{ marginTop: 4 }}>All data stored locally on this device.</div>
        <div style={{ marginTop: 4 }}>
          On Android the database is AES-256 encrypted with a device-specific key.
        </div>
      </div>

      {/* Toast-style flash message */}
      {message && (
        <div style={{
          position: 'fixed', bottom: 90, left: 16, right: 16,
          background: message.type === 'success' ? T.good : T.bad,
          color: '#0a0e15', padding: '12px 16px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, textAlign: 'center', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>
          {message.text}
        </div>
      )}

      {/* Restore confirmation */}
      {pendingRestore && (
        <Confirm
          title="Restore from backup?"
          message={
            `This will replace ALL current data with the backup contents.` +
            (pendingRestore.exportedAt
              ? `\n\nBackup exported: ${new Date(pendingRestore.exportedAt).toLocaleString()}`
              : '')
          }
          onCancel={() => setPendingRestore(null)}
          onConfirm={confirmRestore}
          danger={true}
        />
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
