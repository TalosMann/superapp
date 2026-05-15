/**
 * autoBackup.js — Scheduled auto-backup logic.
 *
 * Triggered once per app launch. Checks the configured frequency against
 * the last successful auto-backup timestamp; if due, runs an export.
 *
 * Backup destination:
 *   1. If user has chosen a directory and we still have permission → write there
 *   2. Otherwise → trigger a browser download (lands in Downloads folder)
 *
 * Versioned filenames: personal-backup-2026-05-13.json
 * Auto-backups get the same filename as manual ones — they're indistinguishable
 * by content. The user can tell them apart by the "Last auto-backup" timestamp
 * shown in settings.
 *
 * Directory handle is stored via IndexedDB (the only place File System Access
 * API handles persist across reloads). We can't store it in localStorage
 * because handles aren't serializable.
 */

import { buildBackup, exportBackup } from './backup.js'
import { Storage } from './storage.js'

const KEY_FREQUENCY = 'personal.backup.frequency'   // 'off'|'daily'|'weekly'|'monthly'
const KEY_LAST_AUTO = 'personal.backup.lastAuto'    // ISO timestamp
const KEY_DIR_LABEL = 'personal.backup.dirLabel'    // human-readable path for display

const IDB_NAME = 'personal-fs'
const IDB_STORE = 'handles'
const IDB_KEY_DIR = 'backupDir'

// ── IndexedDB helpers for storing the directory handle ──────────────────────

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
 * Chrome and Edge yes, Firefox and Safari no.
 */
export function fsApiSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

/**
 * Open the native folder picker. On success, persists the handle and
 * returns { label }. On user cancel, returns null.
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
 * Forget the saved backup directory; future exports go to Downloads.
 */
export async function clearBackupDirectory() {
  await idbDelete(IDB_KEY_DIR)
  await Storage.remove(KEY_DIR_LABEL)
}

/**
 * Get the currently-configured directory label, or null if Downloads is used.
 */
export async function getBackupDirectoryLabel() {
  return await Storage.get(KEY_DIR_LABEL)
}

/**
 * Try to retrieve the saved directory handle.
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
      // Try to re-request silently. If the user has interacted recently this works.
      const req = await handle.requestPermission({ mode: 'readwrite' })
      if (req === 'granted') return handle
    }
  } catch { /* fall through */ }
  return null
}

/**
 * Write a backup file to either the chosen directory (if available) or
 * trigger a normal browser download.
 *
 * Returns { filename, size, location: 'directory'|'download' }
 */
export async function writeBackupToDestination(tag = null) {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const date = new Date().toISOString().split('T')[0]
  const suffix = tag ? `-${tag}` : ''
  const filename = `personal-backup-${date}${suffix}.json`

  // Try directory write first
  const dir = await getWritableBackupDir()
  if (dir) {
    try {
      const file = await dir.getFileHandle(filename, { create: true })
      const writable = await file.createWritable()
      await writable.write(json)
      await writable.close()
      return { filename, size: json.length, location: 'directory' }
    } catch (err) {
      console.warn('[autoBackup] Directory write failed, falling back to download:', err)
      // Fall through to download
    }
  }

  // Fallback: browser download
  return await exportBackup(tag)
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

  // Due — run it
  try {
    const result = await writeBackupToDestination()
    await setLastAutoBackup()
    return { ran: true, result }
  } catch (error) {
    return { ran: false, reason: 'error', error }
  }
}
