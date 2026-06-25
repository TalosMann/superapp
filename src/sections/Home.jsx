/**
 * Home.jsx — Dashboard view + global settings.
 *
 * Dashboard pulls today's events from Timetable and active goals from Goals,
 * presenting a cross-module daily snapshot. Settings holds the backup/restore.
 *
 * Loads data on every visibility change so it stays fresh after editing
 * in other tabs.
 */

import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { T, S } from '../theme.js'
import { Confirm, ProgressBar } from '../shared.jsx'
import Icon from '../Icon.jsx'
import { exportBackup, pickBackupFile, validateBackup, restoreBackup, getStorageStats } from '../backup.js'
import {
  checkAndRun, getFrequency, setFrequency, getLastAutoBackup,
  pickBackupDirectory, clearBackupDirectory, getBackupDirectoryLabel,
  writeBackupToDestination, fsApiSupported, FREQUENCIES,
} from '../autoBackup.js'
import { loadJSON, KEYS } from '../storage.js'
import { isStorageEncrypted } from '../migration.js'
import { verifyPin, setupPin } from '../pinAuth.js'
import { fmtTime, timeToMin, getTodayDayName, fmtDateLong } from '../utils.js'
import { CATEGORY_BY_ID } from './timetable/data.js'
import { TIERS } from './goals/data.js'

export default function Home() {
  const [view, setView] = useState('home') // 'home' | 'settings'
  const [autoBackupToast, setAutoBackupToast] = useState(null)

  // Check auto-backup on first mount (once per app session).
  // Module-level guard prevents firing twice if Home unmounts/remounts.
  useEffect(() => {
    if (window.__autoBackupChecked) return
    window.__autoBackupChecked = true
    ;(async () => {
      const r = await checkAndRun()
      if (r.ran) {
        setAutoBackupToast(`Auto-backup saved (${formatBytes(r.result.size)})`)
        setTimeout(() => setAutoBackupToast(null), 3500)
      }
    })()
  }, [])

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>{view === 'home' ? 'Today' : 'Settings'}</div>
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

      {autoBackupToast && (
        <div style={{
          position: 'fixed', bottom: 90, left: 16, right: 16,
          background: T.good, color: '#0a0e15',
          padding: '12px 16px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, textAlign: 'center', zIndex: 200,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>{autoBackupToast}</div>
      )}
    </div>
  )
}

// ── Dashboard ───────────────────────────────────────────────────────────────

function HomeView() {
  const [events, setEvents] = useState([])
  const [tempEvents, setTempEvents] = useState([])
  const [goals, setGoals] = useState([])
  const [gymSessions, setGymSessions] = useState([])
  const [loaded, setLoaded] = useState(false)

  async function refresh() {
    const [ev, te, gl, gs] = await Promise.all([
      loadJSON(KEYS.TT_EVENTS, []),
      loadJSON(KEYS.TT_TEMP, []),
      loadJSON(KEYS.GOALS_ACTIVE, []),
      loadJSON(KEYS.GYM_SESSIONS, []),
    ])
    setEvents(ev)
    setTempEvents(te)
    setGoals(gl)
    setGymSessions(gs)
    setLoaded(true)
  }

  useEffect(() => {
    refresh()
    function onVis() { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!loaded) return null

  const today = getTodayDayName()
  const todayStr = fmtDateLong(new Date().toISOString().split('T')[0])

  const todayEvents = events.filter(e => e.day === today)
  const todayTempEvents = tempEvents.filter(e => e.day === today)
  const allTodayEvents = [...todayEvents, ...todayTempEvents]
    .sort((a, b) => timeToMin(a.start) - timeToMin(b.start))

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
  const upcomingEvents = allTodayEvents.filter(e => timeToMin(e.end) > nowMin)
  const nextEvent = upcomingEvents[0]

  const goalsByTier = { daily: [], weekly: [], monthly: [] }
  for (const g of goals) goalsByTier[g.tier]?.push(g)

  // Gym week stats — sessions in the last 7 days
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString().split('T')[0]
  const weekSessions = gymSessions.filter(s => s.date >= weekAgoStr)
  const workoutCount = weekSessions.filter(s => s.kind === 'workout').length
  const sportCount = weekSessions.filter(s => s.kind === 'sport').length
  const todaySessions = gymSessions.filter(s => s.date === new Date().toISOString().split('T')[0])

  return (
    <div style={S.scroll}>
      <div style={{ fontSize: 13, color: T.text3, marginBottom: 2 }}>{todayStr}</div>

      {/* Hero card — next event or status */}
      <div style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 16, marginTop: 8, marginBottom: 14,
      }}>
        {nextEvent ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              {nowMin >= timeToMin(nextEvent.start) ? 'Now' : 'Up next'}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700, color: T.text }}>
              {nextEvent.title}
            </div>
            <div className="mono" style={{ fontSize: 12, color: T.text2, marginTop: 4 }}>
              {fmtTime(nextEvent.start)} – {fmtTime(nextEvent.end)}
              {nextEvent.category && CATEGORY_BY_ID[nextEvent.category] && (
                <span style={{ color: CATEGORY_BY_ID[nextEvent.category].color, marginLeft: 8 }}>
                  · {CATEGORY_BY_ID[nextEvent.category].label}
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              {allTodayEvents.length === 0 ? 'Today' : 'Day complete'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>
              {allTodayEvents.length === 0 ? 'No events scheduled' : 'Nothing left on the schedule'}
            </div>
          </>
        )}
      </div>

      {/* Today's timetable */}
      <SectionTitle icon="calendar" label="Schedule" color={T.timetable}
        right={`${allTodayEvents.length} ${allTodayEvents.length === 1 ? 'event' : 'events'}`} />
      {allTodayEvents.length === 0 ? (
        <div style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, fontSize: 13, color: T.text3, textAlign: 'center',
        }}>
          No events scheduled for {today}.
        </div>
      ) : (
        <div style={{ marginBottom: 6 }}>
          {allTodayEvents.slice(0, 6).map(ev => {
            const past = timeToMin(ev.end) <= nowMin
            const live = !past && timeToMin(ev.start) <= nowMin
            const color = ev.color || CATEGORY_BY_ID[ev.category]?.color || T.text2
            const linked = goals.filter(g => {
              if (!g.linkedEventId) return false
              if (ev.isTemp) return g.linkedEventId === ev.id
              return g.linkedEventGroupId === ev.groupId
            })
            return (
              <div key={ev.id} style={{
                background: T.bg2, border: `1px solid ${live ? color : T.border}`,
                borderLeft: `3px solid ${color}`,
                borderRadius: 10, padding: '10px 12px', marginBottom: 6,
                opacity: past ? 0.45 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{ev.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>
                      {fmtTime(ev.start)} – {fmtTime(ev.end)}
                    </div>
                  </div>
                  {live && (
                    <div style={{
                      background: color, color: '#0a0e15', fontSize: 9, fontWeight: 800,
                      padding: '2px 6px', borderRadius: 4, letterSpacing: '.04em',
                    }}>LIVE</div>
                  )}
                  {linked.length > 0 && (
                    <div title={`${linked.length} linked goal${linked.length > 1 ? 's' : ''}`}
                      style={{
                        background: T.goals, color: '#0a0e15', fontSize: 10, fontWeight: 800,
                        padding: '2px 6px', borderRadius: 4,
                      }}>
                      {linked.length}🎯
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {allTodayEvents.length > 6 && (
            <div style={{ fontSize: 12, color: T.text3, textAlign: 'center', padding: 4 }}>
              +{allTodayEvents.length - 6} more
            </div>
          )}
        </div>
      )}

      {/* Active goals */}
      <SectionTitle icon="target" label="Goals" color={T.goals}
        right={`${goals.length} active`} />
      {goals.length === 0 ? (
        <div style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, fontSize: 13, color: T.text3, textAlign: 'center',
        }}>
          No active goals. Tap the Goals tab to add some.
        </div>
      ) : (
        <div>
          {TIERS.map(tier => {
            const tg = goalsByTier[tier.id]
            if (!tg.length) return null
            const done = tg.filter(g =>
              g.kind === 'check' ? g.checkedAt : (g.progress || 0) >= g.target
            ).length
            const pct = Math.round((done / tg.length) * 100)

            return (
              <div key={tier.id} style={{
                background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
                padding: 12, marginBottom: 8,
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 8,
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 800, color: tier.color,
                    textTransform: 'uppercase', letterSpacing: '.06em',
                  }}>{tier.label}</div>
                  <div className="mono" style={{ fontSize: 12, color: T.text3 }}>
                    {done}/{tg.length}
                  </div>
                </div>
                <ProgressBar value={done} max={tg.length} color={tier.color} height={5} bg={T.bg3} />
                {pct === 100 && (
                  <div style={{ fontSize: 11, color: T.good, marginTop: 6, fontWeight: 600 }}>
                    ✓ All {tier.id} goals complete
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Gym & sport — this week */}
      <SectionTitle icon="dumbbell" label="Training" color={T.gym}
        right={`last 7 days`} />
      {weekSessions.length === 0 ? (
        <div style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14, fontSize: 13, color: T.text3, textAlign: 'center',
        }}>
          No sessions logged in the last week.
        </div>
      ) : (
        <div style={{
          background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 14,
        }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: todaySessions.length > 0 ? 10 : 0 }}>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{workoutCount}</div>
              <div style={{ fontSize: 11, color: T.text3 }}>workouts</div>
            </div>
            <div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: T.text }}>{sportCount}</div>
              <div style={{ fontSize: 11, color: T.text3 }}>sport sessions</div>
            </div>
          </div>
          {todaySessions.length > 0 && (
            <div style={{
              fontSize: 11, color: T.good, fontWeight: 600, marginTop: 8,
              paddingTop: 8, borderTop: `1px solid ${T.border}`,
            }}>
              ✓ Logged {todaySessions.length} session{todaySessions.length > 1 ? 's' : ''} today
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SectionTitle({ icon, label, color, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 4px 8px', marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ color }}><Icon name={icon} size={16} /></div>
        <div style={{ fontSize: 12, fontWeight: 800, color: T.text2, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
      </div>
      {right && <div style={{ fontSize: 11, color: T.text3 }}>{right}</div>}
    </div>
  )
}

// ── Settings ────────────────────────────────────────────────────────────────

function SettingsView() {
  const [stats, setStats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [pendingRestore, setPendingRestore] = useState(null)

  // Auto-backup settings state
  const [frequency, setFreqState] = useState('weekly')
  const [lastAuto, setLastAuto] = useState(null)
  const [dirLabel, setDirLabel] = useState(null)
  const fsSupported = fsApiSupported()
  const onNative = Capacitor.isNativePlatform()
  const [encrypted, setEncrypted] = useState(false)
  const [showChangePin, setShowChangePin] = useState(false)

  useEffect(() => { refreshStats(); refreshBackupSettings(); isStorageEncrypted().then(setEncrypted) }, [])

  async function refreshStats() {
    setStats(await getStorageStats())
  }

  async function refreshBackupSettings() {
    setFreqState(await getFrequency())
    setLastAuto(await getLastAutoBackup())
    setDirLabel(await getBackupDirectoryLabel())
  }

  async function handleFrequencyChange(f) {
    await setFrequency(f)
    setFreqState(f)
  }

  async function handlePickDir() {
    try {
      const r = await pickBackupDirectory()
      if (r) {
        setDirLabel(r.label)
        flash('success', `Backups will save to "${r.label}"`)
      }
    } catch (err) {
      flash('error', `Folder picker failed: ${err.message}`)
    }
  }

  async function handleClearDir() {
    await clearBackupDirectory()
    setDirLabel(null)
    flash('success', 'Reverted to Downloads folder')
  }

  function flash(type, text) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 4000)
  }

  async function handleExport() {
    setBusy(true)
    try {
      const result = await writeBackupToDestination(null, { share: true })
      const where = result.location === 'native-share'
        ? 'superapp_exports'
        : result.location === 'directory'
          ? 'chosen folder'
          : 'Downloads'
      flash('success', `Saved ${result.filename} to ${where} (${formatBytes(result.size)})`)
    } catch (err) {
      flash('error', `Export failed: ${err.message}`)
    } finally { setBusy(false) }
  }

  async function handleImport() {
    setBusy(true)
    try {
      const parsed = await pickBackupFile()
      if (!parsed) { setBusy(false); return }
      const v = validateBackup(parsed)
      if (!v.valid) { flash('error', `Invalid backup: ${v.reason}`); setBusy(false); return }
      setPendingRestore({ data: v.data, exportedAt: v.exportedAt })
    } catch (err) {
      flash('error', `Import failed: ${err.message}`)
    } finally { setBusy(false) }
  }

  async function confirmRestore() {
    console.log('[confirmRestore] START')
    setBusy(true)
    try {
      // Try pre-restore safety backup but don't bail if it fails — we'd rather
      // give the user the restore they asked for than refuse over a backup hiccup.
      try {
        console.log('[confirmRestore] writing pre-restore safety backup...')
        const r = await writeBackupToDestination('pre-restore')
        console.log('[confirmRestore] pre-restore saved:', r.location, r.filename)
      } catch (err) {
        console.error('[confirmRestore] pre-restore failed (continuing anyway):', err)
      }

      console.log('[confirmRestore] calling restoreBackup...')
      await restoreBackup(pendingRestore.data)
      console.log('[confirmRestore] restoreBackup completed, reloading in 1.5s')
      flash('success', 'Restored. App will refresh shortly.')
      setPendingRestore(null)
      setTimeout(() => location.reload(), 1500)
    } catch (err) {
      console.error('[confirmRestore] FAILED:', err?.message || err, JSON.stringify(err))
      flash('error', `Restore failed: ${err?.message || err}`)
      setPendingRestore(null)
      setBusy(false)
    }
  }

  return (
    <div style={S.scroll}>
      <div style={{ ...S.card }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Storage</div>
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

      {onNative && (<>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 4px 8px' }}>Security</div>
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
            <div style={{ color: T.accent, marginTop: 2 }}><Icon name="check" size={18} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>App lock</div>
              <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
                PIN required on launch and after 30s in the background.
                {encrypted
                  ? ' Storage is encrypted at rest.'
                  : ' Storage encryption status unknown — restart the app once if this persists.'}
              </div>
            </div>
          </div>
          <button onClick={() => setShowChangePin(true)} style={{
            width: '100%', background: 'transparent', border: `1px solid ${T.border}`,
            borderRadius: 10, padding: 11, color: T.text, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Change PIN</button>
        </div>
      </>)}

      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 4px 8px' }}>Backup</div>

      {/* Destination card — web only (Android writes to Documents/superapp_exports/) */}
      {!onNative && (
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ color: T.accent, marginTop: 2 }}><Icon name="dashboard" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Backup destination</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              {dirLabel
                ? <>Saving to <span className="mono">📁 {dirLabel}</span></>
                : 'Saving to your Downloads folder'}
            </div>
          </div>
        </div>
        {fsSupported ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handlePickDir} style={{
              flex: 1, background: 'transparent', border: `1px solid ${T.border}`,
              borderRadius: 10, padding: 10, color: T.text, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{dirLabel ? 'Change folder' : 'Choose folder'}</button>
            {dirLabel && (
              <button onClick={handleClearDir} style={{
                background: 'transparent', border: `1px solid ${T.border}`,
                borderRadius: 10, padding: '10px 14px', color: T.text3, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>Reset</button>
            )}
          </div>
        ) : (
          <div style={{
            fontSize: 11, color: T.text4, padding: '8px 10px',
            background: T.bg3, borderRadius: 8, lineHeight: 1.4,
          }}>
            Custom folder requires Chrome or Edge. On this browser, backups always go to Downloads.
          </div>
        )}
      </div>
      )}

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ color: T.accent, marginTop: 2 }}><Icon name="chart" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Export everything</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              Manually saves a JSON file with all modules' data to the destination above.
            </div>
          </div>
        </div>
        <button onClick={handleExport} disabled={busy} style={{
          width: '100%', background: T.accent, border: 'none', borderRadius: 10,
          padding: 12, color: '#031018', fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Working…' : 'Export backup now'}</button>
      </div>

      {/* Auto-backup card */}
      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
          <div style={{ color: T.good, marginTop: 2 }}><Icon name="history" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Automatic backups</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              Run on app open if due. Versioned filenames so older backups are preserved.
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {FREQUENCIES.map(f => (
            <button key={f.id} onClick={() => handleFrequencyChange(f.id)} style={{
              flex: 1,
              background: frequency === f.id ? T.good : 'transparent',
              color: frequency === f.id ? '#0a0e15' : T.text2,
              border: `1px solid ${frequency === f.id ? T.good : T.border}`,
              borderRadius: 8, padding: '8px 4px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>{f.label}</button>
          ))}
        </div>
        <div style={{
          fontSize: 11, color: T.text3, padding: '6px 2px 0',
        }}>
          {frequency === 'off'
            ? 'Auto-backups disabled.'
            : lastAuto
              ? <>Last auto-backup: <span className="mono">{relativeTime(lastAuto)}</span></>
              : 'No auto-backups yet — next one runs on next app open.'}
        </div>
      </div>

      <div style={{ ...S.card }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ color: T.warn, marginTop: 2 }}><Icon name="history" size={18} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Restore from backup</div>
            <div style={{ fontSize: 12, color: T.text3, marginTop: 2, lineHeight: 1.4 }}>
              Replaces all current data with the contents of a backup file. A safety backup will be saved automatically before restoring.
            </div>
          </div>
        </div>
        <button onClick={handleImport} disabled={busy} style={{
          width: '100%', background: 'transparent', border: `1px solid ${T.warn}`,
          borderRadius: 10, padding: 12, color: T.warn, fontSize: 14, fontWeight: 700,
          cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
        }}>{busy ? 'Working…' : 'Import backup'}</button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: T.text3, textTransform: 'uppercase', letterSpacing: '.05em', margin: '20px 4px 8px' }}>About</div>
      <div style={{ ...S.card, fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
        <div>Personal v0.5.0 — App lock + encrypted storage</div>
        <div style={{ marginTop: 4 }}>All data stored locally on this device.</div>
      </div>

      {message && (
        <div style={{
          position: 'fixed', bottom: 90, left: 16, right: 16,
          background: message.type === 'success' ? T.good : T.bad,
          color: '#0a0e15', padding: '12px 16px', borderRadius: 10,
          fontSize: 13, fontWeight: 600, textAlign: 'center', zIndex: 100,
          boxShadow: '0 4px 16px rgba(0,0,0,.3)',
        }}>{message.text}</div>
      )}

      {pendingRestore && (
        <Confirm
          title="Restore from backup?"
          message={
            `This will replace ALL current data with the backup contents. ` +
            `A pre-restore safety backup will be saved automatically.` +
            (pendingRestore.exportedAt
              ? `\n\nBackup exported: ${new Date(pendingRestore.exportedAt).toLocaleString()}`
              : '')
          }
          onCancel={() => setPendingRestore(null)}
          onConfirm={confirmRestore}
          danger={true}
          confirmLabel="Restore"
        />
      )}

      {showChangePin && <ChangePinModal onClose={() => setShowChangePin(false)} />}
    </div>
  )
}

function ChangePinModal({ onClose }) {
  const [step, setStep] = useState('verify') // 'verify' | 'create' | 'confirm'
  const [current, setCurrent] = useState('')
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  function digitsOnly(v) { return v.replace(/\D/g, '').slice(0, 6) }

  async function handleVerify() {
    setBusy(true); setErr('')
    const ok = await verifyPin(current)
    setBusy(false)
    if (ok) setStep('create')
    else { setErr('Incorrect PIN'); setCurrent('') }
  }

  function handleCreateNext() {
    if (first.length !== 6) { setErr('Enter all 6 digits'); return }
    setErr(''); setStep('confirm')
  }

  async function handleConfirm() {
    if (second !== first) {
      setErr("PINs don't match — try again")
      setFirst(''); setSecond(''); setStep('create')
      return
    }
    setBusy(true)
    await setupPin(second)
    setBusy(false)
    setDone(true)
    setTimeout(onClose, 1200)
  }

  const inputStyle = {
    background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: '12px 14px', color: T.text, fontSize: 20, letterSpacing: '0.3em',
    textAlign: 'center', width: '100%', fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.card, width: '100%', maxWidth: 340, padding: 24 }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <div style={{ color: T.good, fontWeight: 700 }}>PIN changed</div>
          </div>
        ) : (<>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 6 }}>
            {step === 'verify' ? 'Enter current PIN' : step === 'create' ? 'Choose a new PIN' : 'Confirm new PIN'}
          </div>
          <div style={{ fontSize: 12, color: T.text3, marginBottom: 16 }}>
            {step === 'verify' ? 'Verify it\'s you before changing your PIN' : '6 digits'}
          </div>
          {err && <div style={{ fontSize: 12, color: T.bad, marginBottom: 12 }}>{err}</div>}

          {step === 'verify' && (
            <input autoFocus type="password" inputMode="numeric" style={inputStyle} value={current}
              onChange={e => setCurrent(digitsOnly(e.target.value))} placeholder="······" />
          )}
          {step === 'create' && (
            <input autoFocus type="password" inputMode="numeric" style={inputStyle} value={first}
              onChange={e => setFirst(digitsOnly(e.target.value))} placeholder="······" />
          )}
          {step === 'confirm' && (
            <input autoFocus type="password" inputMode="numeric" style={inputStyle} value={second}
              onChange={e => setSecond(digitsOnly(e.target.value))} placeholder="······" />
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{
              flex: 1, background: 'transparent', border: `1px solid ${T.border}`, borderRadius: 10,
              padding: 11, color: T.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
            <button
              disabled={busy || (step === 'verify' && current.length !== 6) || (step === 'create' && first.length !== 6) || (step === 'confirm' && second.length !== 6)}
              onClick={step === 'verify' ? handleVerify : step === 'create' ? handleCreateNext : handleConfirm}
              style={{
                flex: 1, background: T.accent, border: 'none', borderRadius: 10,
                padding: 11, color: '#0a0e15', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1,
              }}>{step === 'confirm' ? 'Save' : 'Next'}</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function relativeTime(date) {
  const ms = Date.now() - date.getTime()
  const mins = Math.round(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}
