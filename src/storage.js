/**
 * storage.js — Unified storage for Personal super-app.
 *
 * Web (npm run dev)    →  localStorage
 * Android (Capacitor)  →  @capacitor-community/sqlite, SQLCipher-encrypted
 *
 * Encryption is handled once, up front, by migration.js — App.jsx calls
 * ensureEncryptedStorage() before mounting anything that touches Storage.
 * By the time any code in this file runs on native, the encryption secret
 * is already set and the 'personal_secure' database already exists. This
 * file just opens it.
 *
 * Each module owns its own namespace key:
 *   personal.timetable   — events, temp events, accomplishments
 *   personal.finance     — transactions, budgets, goals, etc.
 *   personal.nutrition   — daily logs, body weight, targets
 *   personal.gym         — sessions, exercises, sport entries
 *   personal.goals       — daily, weekly, monthly goals
 *   personal.badges      — accomplishment badges (earned + unearned)
 *   personal.settings    — global app settings (currency, theme, etc.)
 *
 * (The PIN hash lives in @capacitor/preferences, not here — see pinAuth.js.
 * It needs to be readable before any SQLite connection exists at all.)
 */

import { Capacitor } from '@capacitor/core'

const isNative = () => Capacitor.isNativePlatform()
const DB_NAME = 'personal_secure'

// Module-level singleton — never instantiate SQLiteConnection more than once,
// otherwise the JS-side registry diverges from the native-side registry and
// you get "Connection already exists" on createConnection even when
// isConnection returns false.
let _sqlite = null
let _db = null
let _dbInitPromise = null

async function getDB() {
  if (_db) return _db
  // Share an in-flight init promise so concurrent callers don't race and
  // create duplicate connections.
  if (_dbInitPromise) return _dbInitPromise
  _dbInitPromise = initDB().finally(() => { _dbInitPromise = null })
  return _dbInitPromise
}

async function initDB() {
  console.log('[Storage] initializing SQLite connection...')
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
  if (!_sqlite) _sqlite = new SQLiteConnection(CapacitorSQLite)

  // Try retrieve first (handles warm starts where connection persists from
  // a previous app session). Fall through to create on cold starts. If
  // create itself reports "already exists" (stale ghost connection), close
  // it explicitly then create fresh.
  try {
    _db = await _sqlite.retrieveConnection(DB_NAME, false)
    console.log('[Storage] retrieved existing connection')
  } catch {
    try {
      _db = await _sqlite.createConnection(DB_NAME, true, 'secret', 1, false)
      console.log('[Storage] created new encrypted connection')
    } catch (createErr) {
      const msg = String(createErr?.message || createErr)
      if (msg.includes('already exists')) {
        console.log('[Storage] connection in inconsistent state, closing then recreating')
        try { await _sqlite.closeConnection(DB_NAME, false) } catch {}
        _db = await _sqlite.createConnection(DB_NAME, true, 'secret', 1, false)
      } else {
        console.error('[Storage] failed to open encrypted database. Was ensureEncryptedStorage() ' +
          'called before this? The encryption secret must be set first.', createErr)
        throw createErr
      }
    }
  }

  await _db.open()
  await _db.execute(`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`)
  console.log('[Storage] ready')
  return _db
}

// Guard: any null/undefined key is a bug in the caller — log loudly and
// refuse to write, rather than letting it bubble to SQLite's NOT NULL error.
function badKey(key, op) {
  if (key == null || key === '') {
    console.error(`[Storage.${op}] called with bad key:`, JSON.stringify(key),
      '— this is a bug in the caller, ignoring.')
    return true
  }
  return false
}

export const Storage = {
  async get(key) {
    if (badKey(key, 'get')) return null
    if (!isNative()) return localStorage.getItem(key)
    try {
      const db = await getDB()
      const res = await db.query('SELECT value FROM store WHERE key = ?', [key])
      return res.values?.length ? res.values[0].value : null
    } catch (e) {
      console.error('[Storage.get] failed for', key, ':', e?.message || e)
      return null
    }
  },
  async set(key, value) {
    if (badKey(key, 'set')) return
    if (!isNative()) { localStorage.setItem(key, value); return }
    try {
      const db = await getDB()
      await db.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', [key, value])
    } catch (e) {
      console.error('[Storage.set] failed for', key, ':', e?.message || e)
    }
  },
  async remove(key) {
    if (badKey(key, 'remove')) return
    if (!isNative()) { localStorage.removeItem(key); return }
    try {
      const db = await getDB()
      await db.run('DELETE FROM store WHERE key = ?', [key])
    } catch (e) {
      console.error('[Storage.remove] failed for', key, ':', e?.message || e)
    }
  },
  async clearAll() {
    if (!isNative()) { localStorage.clear(); return }
    try {
      const db = await getDB()
      await db.run('DELETE FROM store')
    } catch (e) { console.error('[Storage.clearAll]', e) }
  },
}

// ── Module-scoped JSON helpers ────────────────────────────────────────────────

export async function loadJSON(key, fallback) {
  const raw = await Storage.get(key)
  if (!raw) return fallback
  try { return JSON.parse(raw) } catch { return fallback }
}

export async function saveJSON(key, value) {
  await Storage.set(key, JSON.stringify(value))
}

// ── Storage keys ─────────────────────────────────────────────────────────────

export const KEYS = {
  // Timetable
  TT_EVENTS: 'personal.timetable.events',
  TT_TEMP: 'personal.timetable.temp',
  TT_ACC: 'personal.timetable.acc',
  TT_ONBOARDED: 'personal.timetable.onboarded',
  TT_SOUND: 'personal.timetable.sound',
  TT_NOTIFY_ON: 'personal.timetable.notify_on',
  // Finance
  FIN_DATA: 'personal.finance.data',
  // Nutrition
  NUT_LOGS: 'personal.nutrition.logs',
  NUT_WEIGHTS: 'personal.nutrition.weights',
  NUT_TARGETS: 'personal.nutrition.targets',
  NUT_FOODS: 'personal.nutrition.foods', // food library
  NUT_MEALS: 'personal.nutrition.meals', // saved meal presets
  // Gym
  GYM_SESSIONS: 'personal.gym.sessions',
  GYM_EXERCISES: 'personal.gym.exercises', // exercise library
  GYM_SPORTS: 'personal.gym.sports', // sport library
  // Goals
  GOALS_ACTIVE:   'personal.goals.active',
  GOALS_ARCHIVE:  'personal.goals.archive',
  // Badges (Stage 4+)
  BADGES: 'personal.badges',
  // Global
  SETTINGS: 'personal.settings',
  // Note: PIN_HASH removed from here — it now lives in @capacitor/preferences
  // (see pinAuth.js), not in this SQLite store. It needs to be readable
  // before any database connection exists.
}
