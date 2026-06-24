/**
 * backup.js — Export/import the entire app state as a JSON file.
 *
 * Web:     uses a Blob URL + invisible <a download> click → browser save dialog
 * Android: uses @capacitor/filesystem to write, @capacitor/share to share
 *
 * The export captures every namespaced key under `personal.*`,
 * tagged with a version number for future migrations.
 */

import { Capacitor } from '@capacitor/core'
import { Storage, KEYS } from './storage.js'

const BACKUP_VERSION = 1
const APP_TAG = 'personal-superapp'

// All keys we know about. Listed explicitly rather than "everything starting
// with personal." so we have a single source of truth and don't accidentally
// export stale or unrelated localStorage entries.
const ALL_KEYS = Object.values(KEYS)

const isNative = () => Capacitor.isNativePlatform()

// ── Native helpers ──────────────────────────────────────────────────────────

const NATIVE_DIR = 'superapp_exports'

/**
 * Write a JSON string to Documents/superapp_exports/<filename> on Android.
 * Creates the directory if it doesn't exist.
 * Returns { uri } with the file URI for share.
 */
export async function writeNative(filename, json) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')

  // Ensure the subdirectory exists. mkdir with recursive:true is a no-op if
  // it already exists, so safe to call every time.
  try {
    await Filesystem.mkdir({
      path: NATIVE_DIR,
      directory: Directory.Documents,
      recursive: true,
    })
  } catch (e) {
    // Older plugin versions throw if dir exists even with recursive:true.
    // Ignore those and proceed — the writeFile call below will catch real errors.
    const msg = String(e?.message || e)
    if (!msg.includes('exists')) throw e
  }

  const result = await Filesystem.writeFile({
    path: `${NATIVE_DIR}/${filename}`,
    data: json,
    directory: Directory.Documents,
    encoding: 'utf8',
  })

  return { uri: result.uri }
}

/**
 * Write to Documents/superapp_exports/ then open the native share sheet.
 * Used for manual "Export backup now" on Android.
 */
export async function exportNative(filename, json) {
  const { uri } = await writeNative(filename, json)
  const { Share } = await import('@capacitor/share')
  await Share.share({
    title: filename,
    text: 'Personal app backup',
    url: uri,
    dialogTitle: 'Save or share backup',
  })
  return { filename, size: json.length, location: 'native-share', uri }
}

// ── Export ──────────────────────────────────────────────────────────────────

/**
 * Build the backup object. Each key is loaded, attempted-parsed as JSON
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
 * Build filename with date and optional tag.
 */
export function buildFilename(tag = null) {
  const date = new Date().toISOString().split('T')[0]
  const suffix = tag ? `-${tag}` : ''
  return `personal-backup-${date}${suffix}.json`
}

/**
 * Trigger a download/share of the backup as a JSON file.
 * On Android: writes to Documents/superapp_exports/ and opens share sheet.
 * On web:     blob URL + invisible <a download> click → browser save dialog.
 *
 * Optional `tag` is appended to the filename (e.g. 'pre-restore').
 */
export async function exportBackup(tag = null) {
  const backup = await buildBackup()
  const json = JSON.stringify(backup, null, 2)
  const filename = buildFilename(tag)

  if (isNative()) {
    return await exportNative(filename, json)
  }

  // Web path — blob anchor click
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)

  return { filename, size: blob.size, keys: Object.keys(backup.data).length, location: 'download' }
}

// ── Import ──────────────────────────────────────────────────────────────────

/**
 * Open the system file picker, return the parsed backup object on success.
 * Returns null if the user cancels.
 * Works on both web and Android (Capacitor WebView supports <input type=file>).
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
