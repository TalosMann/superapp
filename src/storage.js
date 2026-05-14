/**
 * storage.js — Unified storage for Personal super-app.
 *
 * Web (npm run dev)    →  localStorage
 * Android (Capacitor)  →  @capacitor-community/sqlite, AES-256 encrypted
 *
 * Each module owns its own namespace key:
 *   personal.timetable   — events, temp events, accomplishments
 *   personal.finance     — transactions, budgets, goals, etc.
 *   personal.nutrition   — daily logs, body weight, targets
 *   personal.gym         — sessions, exercises, sport entries
 *   personal.goals       — daily, weekly, monthly goals
 *   personal.badges      — accomplishment badges (earned + unearned)
 *   personal.settings    — global app settings (currency, theme, etc.)
 *   personal.pin         — SHA-256 PIN hash
 */

import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

const isNative = () => Capacitor.isNativePlatform()

async function getPassphrase() {
  try {
    const info = await Device.getId()
    const uuid = info.identifier || 'fallback-device-id'
    return `Personal_2026_${uuid}_kP9#mX2$`
  } catch {
    return 'Personal_2026_fallback_kP9#mX2$'
  }
}

let _db = null
async function getDB() {
  if (_db) return _db
  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
  const sqlite = new SQLiteConnection(CapacitorSQLite)
  const passphrase = await getPassphrase()
  const dbName = 'personal'
  const isConn = (await sqlite.isConnection(dbName, false)).result
  if (isConn) _db = await sqlite.retrieveConnection(dbName, false)
  else _db = await sqlite.createConnection(dbName, true, passphrase, 1, false)
  await _db.open()
  await _db.execute(`CREATE TABLE IF NOT EXISTS store (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)`)
  return _db
}

export const Storage = {
  async get(key) {
    if (!isNative()) return localStorage.getItem(key)
    try {
      const db = await getDB()
      const res = await db.query('SELECT value FROM store WHERE key = ?', [key])
      return res.values?.length ? res.values[0].value : null
    } catch (e) { console.error('[Storage.get]', e); return null }
  },
  async set(key, value) {
    if (!isNative()) { localStorage.setItem(key, value); return }
    try {
      const db = await getDB()
      await db.run('INSERT OR REPLACE INTO store (key, value) VALUES (?, ?)', [key, value])
    } catch (e) { console.error('[Storage.set]', e) }
  },
  async remove(key) {
    if (!isNative()) { localStorage.removeItem(key); return }
    try {
      const db = await getDB()
      await db.run('DELETE FROM store WHERE key = ?', [key])
    } catch (e) { console.error('[Storage.remove]', e) }
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
  PIN_HASH: 'personal.pin',
}
