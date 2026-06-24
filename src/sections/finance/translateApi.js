/**
 * translateApi.js — Optional, opt-in network translation via Google Cloud
 * Translation API (Basic v2, REST).
 *
 * OFF BY DEFAULT. Only called when the person has explicitly enabled
 * translation in Finance → Settings and entered their own API key. Only
 * transaction description/note text is ever sent — never amounts, dates,
 * categories, account names, or anything else.
 *
 * This is a deliberate second layer, not a replacement for the offline
 * dictionary in translateAlipay.js. That layer runs first, for free, with
 * no network call; this layer only handles whatever text is still in
 * Chinese afterward, so monthly API usage stays small even as transaction
 * volume grows.
 *
 * Setup (free tier comfortably covers personal use — 500,000 characters/
 * month at no cost; a typical month of transaction notes is a few thousand
 * characters):
 *   1. console.cloud.google.com → create or select a project
 *   2. Enable the "Cloud Translation API"
 *   3. APIs & Services → Credentials → Create API key, restrict it to the
 *      Cloud Translation API
 *   4. Paste the key into Finance → Settings → Translation
 *
 * The key is stored in FIN_DATA alongside everything else — i.e. in
 * Personal's current unencrypted local storage, same as every other
 * module. Real encryption is planned for Stage 6, not yet built.
 */

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'
const MAX_PER_REQUEST = 100 // chunk size — comfortably under Google's per-request limits

/**
 * Translate a batch of strings to English, chunked into requests of
 * MAX_PER_REQUEST. Returns an array of translated strings in the same
 * order as the input. On any failure for a chunk (bad key, no network,
 * quota exceeded), that chunk's original strings are kept unchanged rather
 * than thrown — a failed translation should never break an import.
 */
export async function translateBatch(texts, apiKey) {
  if (!texts.length || !apiKey) return texts.slice()

  const out = new Array(texts.length)
  for (let start = 0; start < texts.length; start += MAX_PER_REQUEST) {
    const chunk = texts.slice(start, start + MAX_PER_REQUEST)
    const translatedChunk = await translateChunk(chunk, apiKey)
    for (let i = 0; i < chunk.length; i++) out[start + i] = translatedChunk[i]
  }
  return out
}

async function translateChunk(texts, apiKey) {
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target: 'en', format: 'text' }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Translation API returned ${res.status}: ${body.slice(0, 200)}`)
    }
    const json = await res.json()
    const translations = json?.data?.translations
    if (!Array.isArray(translations) || translations.length !== texts.length) {
      throw new Error('Unexpected response shape from translation API')
    }
    return translations.map(t => decodeHtmlEntities(t.translatedText))
  } catch (e) {
    console.error('[finance/translateApi] chunk failed, keeping original text:', e)
    return texts
  }
}

// Google's API returns HTML-entity-escaped text (e.g. &#39; for ') — decode for display.
function decodeHtmlEntities(str) {
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

/**
 * Quick connectivity/key check — translates a single short word and
 * reports success/failure, for a "Test connection" button in Settings.
 */
export async function testApiKey(apiKey) {
  if (!apiKey) return { ok: false, error: 'No API key entered' }
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: ['你好'], target: 'en', format: 'text' }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 150)}` }
    }
    const json = await res.json()
    const translated = json?.data?.translations?.[0]?.translatedText
    if (!translated) return { ok: false, error: 'Unexpected response from API' }
    return { ok: true, sample: decodeHtmlEntities(translated) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
