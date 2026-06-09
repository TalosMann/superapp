/**
 * backup.js — Export/import the entire app state as a JSON file.
 *
 * Web:     uses a Blob URL + invisible <a download> click → browser save dialog
 * Android: same code, but Capacitor's WebView routes the download through
 *          Android's download manager → file lands in /Download/
 *
 * The export captures every namespaced key under `personal.*`,
 * tagged with a version number for future migrations.
 */

import { Storage, KEYS } from './storage.js'

const BACKUP_VERSION = 1
const APP_TAG = 'personal-superapp'

// All keys we know about. Listed explicitly rather than "everything starting
// with personal." so we have a single source of truth and don't accidentally
// export stale or unrelated localStorage entries.
const ALL_KEYS = Object.values(KEYS)

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Build the backup blob. Each key is loaded, attempted-parsed as JSON
 * (so the export is structured, not double-stringified), and bundled with
 * metadata.
 */
export async function buildBackup() {
  const data = {}
  for (const key of ALL_KEYS) {
    const raw = await Storage.get(key)
    if (raw == null) continue
    try { data[key] = JSON.parse(raw) }
    catch { data[key] = raw } // for non-JSON values (e.g. PIN hash)
  }
  return {
    app: APP_TAG,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
}

/**
 * Trigger a download of the backup as a JSON file.
 * Filename includes the date so multiple exports don't collide.
 * Optional `tag` is appended to the filename to distinguish automatic
 * backups (e.g. 'pre-restore') from user-initiated ones.
 */
export async function exportBackup(tag = null) {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const date = new Date().toISOString().split('T')[0]
  const suffix = tag ? `-${tag}` : ''
  const filename = `personal-backup-${date}${suffix}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)

  // Free the blob URL after the click finishes
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { filename, size: blob.size, keys: Object.keys(backup.data).length, location: 'download' }
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Open the system file picker, return the parsed backup object on success.
 * Returns null if the user cancels.
 */
export function pickBackupFile() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      try {
        const text = await file.text()
        const parsed = JSON.parse(text)
        resolve(parsed)
      } catch (err) {
        reject(new Error('File is not valid JSON'))
      }
    }

    // If the user closes the picker without selecting, no event fires.
    // We don't wait — the promise resolves only on selection, which is fine
    // because we don't pin the UI on it.
    input.click()
  })
}

/**
 * Validate a parsed backup object.
 * Returns { valid: bool, reason?, data?, version?, exportedAt? }.
 */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return { valid: false, reason: 'Not an object' }
  if (obj.app !== APP_TAG) return { valid: false, reason: 'Not a Personal backup file' }
  if (typeof obj.version !== 'number') return { valid: false, reason: 'Missing version' }
  if (obj.version > BACKUP_VERSION) return { valid: false, reason: `Backup is from a newer version (v${obj.version})` }
  if (!obj.data || typeof obj.data !== 'object') return { valid: false, reason: 'Missing data' }
  return { valid: true, data: obj.data, version: obj.version, exportedAt: obj.exportedAt }
}

/**
 * Replace ALL current data with the backup contents.
 * Keys not in the backup are wiped — this is a true "restore from backup",
 * not a merge.
 */
export async function restoreBackup(backupData) {
  console.log('[restore] START — keys in backup:', Object.keys(backupData).length)

  // Wipe known keys first
  console.log('[restore] wiping', ALL_KEYS.length, 'known keys...')
  for (const key of ALL_KEYS) {
    try {
      await Storage.remove(key)
    } catch (e) {
      console.error('[restore] FAILED to remove', key, e)
      throw e
    }
  }
  console.log('[restore] wipe complete')

  // Write each backup entry
  let written = 0
  for (const [key, value] of Object.entries(backupData)) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    console.log('[restore] writing', key, '(' + raw.length + ' chars)')
    try {
      await Storage.set(key, raw)
      written++
    } catch (e) {
      console.error('[restore] FAILED to write', key, e)
      throw e
    }
  }
  console.log('[restore] DONE — wrote', written, 'keys')

  // Verify a write went through by reading one back
  if (backupData['personal.timetable.events']) {
    const check = await Storage.get('personal.timetable.events')
    console.log('[restore] verify read of timetable.events — got', check ? check.length + ' chars' : 'NULL')
  }
}

// ── Stats helper for the UI ─────────────────────────────────────────────────

/**
 * Quick summary of what's in the current store, for the Settings screen.
 */
export async function getStorageStats() {
  let totalBytes = 0
  let keyCount = 0
  for (const key of ALL_KEYS) {
    const raw = await Storage.get(key)
    if (raw == null) continue
    keyCount++
    totalBytes += raw.length
  }
  return { keyCount, totalBytes }
}
