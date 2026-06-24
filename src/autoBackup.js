/**
 * autoBackup.js — Scheduled auto-backup logic.
 *
 * Triggered once per app launch. Checks the configured frequency against
 * the last successful auto-backup timestamp; if due, runs an export.
 *
 * Backup destination (three paths, checked in order):
 *
 *   Android (native):
 *     → Silent write to Documents/superapp_exports/
 *       No share sheet — auto-backup runs unattended on app open.
 *
 *   Web, user has chosen a directory + permission still valid:
 *     → Write directly into that directory via File System Access API
 *
 *   Web, no directory / permission lapsed:
 *     → Blob URL + <a download> click → Downloads folder
 *
 * Manual "Export backup now" in Settings goes through writeBackupToDestination()
 * with { share: true }, which opens the Android share sheet instead of writing
 * silently. Web paths are unaffected.
 *
 * Directory handle (web only) is stored in IndexedDB — the only place FS
 * Access API handles survive page reloads. Not used on Android at all.
 *
 * Versioned filenames: personal-backup-2026-05-13.json
 */

import { Capacitor } from '@capacitor/core'
import { buildBackup, buildFilename, writeNative, exportNative } from './backup.js'
import { Storage } from './storage.js'

const KEY_FREQUENCY = 'personal.backup.frequency'   // 'off'|'daily'|'weekly'|'monthly'
const KEY_LAST_AUTO = 'personal.backup.lastAuto'    // ISO timestamp
const KEY_DIR_LABEL = 'personal.backup.dirLabel'    // human-readable path for display (web only)

const IDB_NAME = 'personal-fs'
const IDB_STORE = 'handles'
const IDB_KEY_DIR = 'backupDir'

const isNative = () => Capacitor.isNativePlatform()

// ── IndexedDB helpers for storing the directory handle (web only) ───────────

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key, value) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDelete(key) {
  const db = await openIDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Whether File System Access API is available in this browser.
 * Chrome and Edge yes, Firefox and Safari no, Android WebView no.
 * On Android we always use the native path instead.
 */
export function fsApiSupported() {
  return !isNative() && typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Open the native folder picker (web only). On success, persists the handle
 * and returns { label }. On user cancel, returns null.
 */
export async function pickBackupDirectory() {
  if (!fsApiSupported()) throw new Error('Folder picker not supported in this browser')
  let handle
  try {
    handle = await window.showDirectoryPicker({
      mode: 'readwrite',
      id: 'personal-backup-dir',  // browser remembers last choice for this id
    })
  } catch (err) {
    if (err.name === 'AbortError') return null  // user cancelled
    throw err
  }
  await idbSet(IDB_KEY_DIR, handle)
  const label = handle.name
  await Storage.set(KEY_DIR_LABEL, label)
  return { label }
}

/**
 * Forget the saved backup directory; future web exports go to Downloads.
 */
export async function clearBackupDirectory() {
  await idbDelete(IDB_KEY_DIR)
  await Storage.remove(KEY_DIR_LABEL)
}

/**
 * Get the currently-configured directory label, or null if Downloads is used.
 * Always null on Android (native path doesn't use this).
 */
export async function getBackupDirectoryLabel() {
  if (isNative()) return null
  return await Storage.get(KEY_DIR_LABEL)
}

/**
 * Try to retrieve the saved directory handle (web only).
 * Returns null if no handle saved OR if we lost permission (e.g. after a
 * browser restart). Caller should fall back to browser download.
 */
export async function getWritableBackupDir() {
  if (!fsApiSupported()) return null
  let handle
  try { handle = await idbGet(IDB_KEY_DIR) }
  catch { return null }
  if (!handle) return null
  // Check permission status
  try {
    const perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm === 'granted') return handle
    if (perm === 'prompt') {
      const req = await handle.requestPermission({ mode: 'readwrite' })
      if (req === 'granted') return handle
    }
  } catch { /* fall through */ }
  return null
}

/**
 * Write a backup to the appropriate destination.
 *
 * On Android (native):
 *   - share: false (default) → silent write to Documents/superapp_exports/
 *   - share: true            → write then open the native share sheet
 *
 * On web:
 *   - chosen directory (FS Access) → write there
 *   - fallback                     → blob download
 *
 * `tag` is appended to the filename (e.g. 'pre-restore').
 *
 * Returns { filename, size, location }
 *   location: 'native-silent' | 'native-share' | 'directory' | 'download'
 */
export async function writeBackupToDestination(tag = null, { share = false } = {}) {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const filename = buildFilename(tag)

  // ── Android native path ──────────────────────────────────────────────────
  if (isNative()) {
    if (share) {
      // Manual export: write + share sheet
      const result = await exportNative(filename, json)
      return { filename, size: json.length, location: 'native-share' }
    } else {
      // Auto-backup / pre-restore: silent write only
      await writeNative(filename, json)
      return { filename, size: json.length, location: 'native-silent' }
    }
  }

  // ── Web: try chosen directory first ─────────────────────────────────────
  const dir = await getWritableBackupDir()
  if (dir) {
    try {
      const file = await dir.getFileHandle(filename, { create: true })
      const writable = await file.createWritable()
      await writable.write(json)
      await writable.close()
      return { filename, size: json.length, location: 'directory' }
    } catch (err) {
      console.warn('[autoBackup] directory write failed, falling back to download:', err)
    }
  }

  // ── Web: blob download fallback ──────────────────────────────────────────
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { filename, size: blob.size, location: 'download' }
}

// ── Frequency settings ──────────────────────────────────────────────────────

export const FREQUENCIES = [
  { id: 'off',     label: 'Off',     days: null },
  { id: 'daily',   label: 'Daily',   days: 1 },
  { id: 'weekly',  label: 'Weekly',  days: 7 },
  { id: 'monthly', label: 'Monthly', days: 30 },
]

const FREQ_BY_ID = Object.fromEntries(FREQUENCIES.map(f => [f.id, f]))

export async function getFrequency() {
  const v = await Storage.get(KEY_FREQUENCY)
  return v && FREQ_BY_ID[v] ? v : 'weekly'  // default weekly
}

export async function setFrequency(freq) {
  if (!FREQ_BY_ID[freq]) throw new Error(`Bad frequency: ${freq}`)
  await Storage.set(KEY_FREQUENCY, freq)
}

export async function getLastAutoBackup() {
  const v = await Storage.get(KEY_LAST_AUTO)
  return v ? new Date(v) : null
}

async function setLastAutoBackup(date = new Date()) {
  await Storage.set(KEY_LAST_AUTO, date.toISOString())
}

// ── The check-and-fire function called on app start ─────────────────────────

/**
 * Returns one of:
 *   { ran: false, reason: 'disabled' | 'not-due' }
 *   { ran: true, result: { filename, size, location } }
 *   { ran: false, reason: 'error', error }
 */
export async function checkAndRun() {
  const freq = await getFrequency()
  if (freq === 'off') return { ran: false, reason: 'disabled' }

  const last = await getLastAutoBackup()
  const days = FREQ_BY_ID[freq].days
  if (last) {
    const elapsed = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)
    if (elapsed < days) return { ran: false, reason: 'not-due', daysUntil: days - elapsed }
  }

  // Due — run it (no share sheet for auto-backup)
  try {
    const result = await writeBackupToDestination()
    await setLastAutoBackup()
    return { ran: true, result }
  } catch (error) {
    return { ran: false, reason: 'error', error }
  }
}
