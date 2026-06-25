/**
 * migration.js — One-time migration from the old unencrypted SQLite database
 * ('personal') to a new SQLCipher-encrypted one ('personal_secure').
 *
 * SAFETY MODEL — this runs against real, already-accumulated user data, so it
 * is deliberately conservative:
 *
 *   1. The old unencrypted database is NEVER deleted or modified by this
 *      file. Ever. It is only ever read from.
 *   2. The new encrypted database is only considered "live" (i.e. the rest
 *      of the app starts using it) after every row copied into it has been
 *      read back and compared against the source, count-for-count and
 *      value-for-value.
 *   3. If verification fails for any reason, migration is aborted, nothing
 *      is marked complete, and the app continues running on whatever state
 *      it was already in (old DB if this is a fresh attempt, or stays
 *      un-migrated). The error is surfaced to the UI rather than retried
 *      silently in a loop.
 *   4. Migration state is tracked in @capacitor/preferences (not affected by
 *      any SQLite-level failure), so a half-finished attempt is detected and
 *      safely retried on next launch rather than silently skipped or redone
 *      from a broken state.
 *
 * What "encryption" means here, honestly: this protects the database FILE
 * from being read if it leaks on its own (e.g. certain backup/export paths,
 * or someone copying just the .db file off the device). It does NOT mean
 * the data is unreadable without the PIN to someone with full root-level
 * access to the device's app-private storage — the SQLCipher plugin persists
 * its own encryption secret natively (Android SharedPreferences), separate
 * from and not gated by this app's PIN screen. The PIN is a UI access gate;
 * the encryption is at-rest file protection. Both are real and both are
 * worth having — neither should be oversold as more than it is.
 */

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const isNative = () => Capacitor.isNativePlatform()

const OLD_DB_NAME = 'personal'
const NEW_DB_NAME = 'personal_secure'

const PREF_MIGRATED = 'personal.storage.encMigrated'   // 'true' once fully verified
const PREF_SECRET_SET = 'personal.storage.secretSet'   // 'true' once setEncryptionSecret has been called

/**
 * Call once, early, before any module tries to read/write storage.
 * Returns { status: 'ready' } | { status: 'migrating' } (only relevant for
 * UI display during the call — by the time this resolves it's done) |
 * { status: 'error', error, detail }.
 *
 * Safe to call on every app start — it's a no-op (just returns 'ready')
 * once migration is already verified complete.
 */
export async function ensureEncryptedStorage(onProgress) {
  if (!isNative()) return { status: 'ready' } // web/dev — untouched, plain localStorage

  const already = await Preferences.get({ key: PREF_MIGRATED })
  if (already.value === 'true') return { status: 'ready' }

  try {
    onProgress?.('Setting up secure storage…')
    await migrate(onProgress)
    await Preferences.set({ key: PREF_MIGRATED, value: 'true' })
    return { status: 'ready' }
  } catch (e) {
    console.error('[migration] FAILED — old database is untouched, nothing was lost:', e)
    return { status: 'error', error: e?.message || String(e), detail: e }
  }
}

async function migrate(onProgress) {
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
  const sqlite = new SQLiteConnection(CapacitorSQLite)

  // ── Step 1: set the encryption secret (only once, ever) ──────────────────
  const secretFlag = await Preferences.get({ key: PREF_SECRET_SET })
  if (secretFlag.value !== 'true') {
    const isStored = await sqlite.isSecretStored()
    if (!isStored.result) {
      onProgress?.('Generating encryption key…')
      const passphrase = randomPassphrase()
      await sqlite.setEncryptionSecret(passphrase)
    }
    await Preferences.set({ key: PREF_SECRET_SET, value: 'true' })
  }

  // ── Step 2: read everything from the old unencrypted DB, if it exists ────
  onProgress?.('Reading existing data…')
  const oldRows = await readOldDatabase(sqlite)
  console.log(`[migration] read ${oldRows.length} rows from old unencrypted database`)

  // ── Step 3: create the new encrypted DB and write everything into it ─────
  onProgress?.('Writing to secure storage…')
  const newDb = await openNewEncryptedDb(sqlite)
  for (const row of oldRows) {
    await newDb.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', [row.key, row.value])
  }

  // ── Step 4: verify — read back and compare, row for row ──────────────────
  onProgress?.('Verifying…')
  const verifyRes = await newDb.query('SELECT key, value FROM store')
  const newRows = verifyRes.values || []

  if (newRows.length !== oldRows.length) {
    throw new Error(`Verification failed: copied ${oldRows.length} rows but new database has ${newRows.length}`)
  }
  const oldByKey = new Map(oldRows.map(r => [r.key, r.value]))
  for (const row of newRows) {
    if (oldByKey.get(row.key) !== row.value) {
      throw new Error(`Verification failed: mismatch on key "${row.key}"`)
    }
  }

  console.log(`[migration] verified ${newRows.length} rows match exactly — migration complete`)
  // Old database is deliberately left on disk, untouched, as a safety net.
  // It is simply never opened again after this point.
  await sqlite.closeConnection(NEW_DB_NAME, false).catch(() => {})
}

/**
 * Read all rows from the old unencrypted database. Returns [] if the old
 * database doesn't exist (fresh install — nothing to migrate).
 */
async function readOldDatabase(sqlite) {
  let db
  try {
    const exists = await sqlite.isDatabase(OLD_DB_NAME)
    if (!exists.result) return []

    try {
      db = await sqlite.retrieveConnection(OLD_DB_NAME, false)
    } catch {
      db = await sqlite.createConnection(OLD_DB_NAME, false, 'no-encryption', 1, false)
    }
    await db.open()

    const hasTable = await db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name='store'`)
    if (!hasTable.values?.length) return []

    const res = await db.query('SELECT key, value FROM store')
    return res.values || []
  } finally {
    if (db) await sqlite.closeConnection(OLD_DB_NAME, false).catch(() => {})
  }
}

async function openNewEncryptedDb(sqlite) {
  let db
  try {
    db = await sqlite.retrieveConnection(NEW_DB_NAME, false)
  } catch {
    db = await sqlite.createConnection(NEW_DB_NAME, true, 'secret', 1, false)
  }
  await db.open()
  await db.execute(`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`)
  return db
}

function randomPassphrase() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * For the Settings screen: whether migration has completed. Used to decide
 * whether to show any "secure storage" status indicator.
 */
export async function isStorageEncrypted() {
  if (!isNative()) return false
  const res = await Preferences.get({ key: PREF_MIGRATED })
  return res.value === 'true'
}

export const ENCRYPTED_DB_NAME = NEW_DB_NAME
