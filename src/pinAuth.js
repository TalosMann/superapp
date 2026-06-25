/**
 * pinAuth.js — PIN setup and verification for the app-wide lock screen.
 *
 * Deliberately independent of the SQLite encryption in migration.js. This is
 * purely an access gate for the app's UI — it doesn't gate decryption of the
 * database (see migration.js's header comment for why that's not realistic
 * with the current SQLCipher plugin). Stored via @capacitor/preferences,
 * not SQLite, so it works before/independent of any database connection.
 *
 * Hash: PBKDF2-SHA256, 100,000 iterations, random salt. Worth being honest
 * that for a 6-digit PIN (1,000,000 possible values) the choice of hash
 * function barely matters against an attacker who already has the hash —
 * brute-forcing a 6-digit space is fast regardless of algorithm. What
 * actually matters in practice is that this hash isn't trivially reachable
 * in the first place (see migration.js), and that the PIN entry UI itself
 * doesn't allow unlimited rapid-fire guessing.
 */

import { Preferences } from '@capacitor/preferences'

const PIN_HASH_KEY = 'personal.pin.hash'
const PIN_SALT_KEY = 'personal.pin.salt'

const PBKDF2_ITERATIONS = 100_000

async function deriveHash(pin, saltBytes) {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    256
  )
  return bytesToHex(new Uint8Array(bits))
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  return bytes
}

/**
 * Whether a PIN has been set up on this device.
 */
export async function hasPinSet() {
  const res = await Preferences.get({ key: PIN_HASH_KEY })
  return !!res.value
}

/**
 * Set up a new PIN (first-time setup, or as part of "Change PIN" after the
 * old PIN has already been verified by the caller).
 */
export async function setupPin(pin) {
  const saltBytes = new Uint8Array(16)
  crypto.getRandomValues(saltBytes)
  const hash = await deriveHash(pin, saltBytes)
  await Preferences.set({ key: PIN_SALT_KEY, value: bytesToHex(saltBytes) })
  await Preferences.set({ key: PIN_HASH_KEY, value: hash })
}

/**
 * Check a PIN attempt against the stored hash. Returns true/false.
 */
export async function verifyPin(pin) {
  const [saltRes, hashRes] = await Promise.all([
    Preferences.get({ key: PIN_SALT_KEY }),
    Preferences.get({ key: PIN_HASH_KEY }),
  ])
  if (!saltRes.value || !hashRes.value) return false
  const saltBytes = hexToBytes(saltRes.value)
  const attemptHash = await deriveHash(pin, saltBytes)
  return attemptHash === hashRes.value
}

/**
 * Remove the stored PIN entirely. Not currently exposed in the UI (no
 * "disable lock screen" option) but kept available — e.g. useful for a
 * future "reset" flow, or for testing.
 */
export async function clearPin() {
  await Preferences.remove({ key: PIN_HASH_KEY })
  await Preferences.remove({ key: PIN_SALT_KEY })
}
