/**
 * importAlipay.js — Parses Alipay "cashbook" (记账本) CSV exports.
 *
 * This is Alipay's personal bookkeeping export, not a raw bank-style
 * transaction log — it arrives already categorized into Chinese category
 * names. File format specifics (observed from real exports):
 *
 *   - Encoding: GB18030 (not UTF-8) — caller must decode the raw bytes with
 *     TextDecoder('gb18030') before passing text in here.
 *   - A multi-line Chinese disclaimer precedes the actual header row
 *     ("记录时间,分类,收支类型,金额,备注,账户,来源,标签,") — we scan for it
 *     rather than assuming a fixed line count, since disclaimer length can
 *     vary between exports.
 *   - Fixed 9 comma-separated fields per row (the 9th is always empty, a
 *     trailing comma in the header). We rely on this fixed shape rather than
 *     a general CSV parser because Alipay deliberately uses full-width
 *     commas (，) instead of ASCII commas inside multi-item note text, so a
 *     simple split(',') is safe here.
 *   - Amounts use full-width commas as thousands separators (e.g. "1，000.00")
 *     — must be stripped before parseFloat.
 *   - 收支类型 (income/expense type) has a third value besides 收入/支出:
 *     不计收支 ("doesn't count as income/expense") — covers balance top-ups,
 *     withdrawals, and refunds. These are excluded entirely; Personal's
 *     transaction model only has income/expense, no neutral type.
 *
 * Dedup: every Alipay-sourced transaction gets a `sourceKey` built from its
 * exact recorded timestamp + raw amount string + note. Re-uploading a
 * statement whose date range overlaps a previous import is safe — rows
 * matching an existing transaction's sourceKey are silently skipped.
 */

import { uid } from '../../utils.js'
import { translateDesc } from './translateAlipay.js'
import { translateBatch } from './translateApi.js'

const CHINESE_RE = /[\u4e00-\u9fff]/

const HEADER_PREFIX = '记录时间,分类,收支类型'
const FULLWIDTH_COMMA = /，/g
const EXCLUDED_KIND = '不计收支'

// Alipay category name -> existing Finance builtin category id.
const CATEGORY_MAP = {
  '餐饮': 'food',
  '交通': 'transport',
  '购物': 'shopping',
  '穿搭美容': 'shopping',
  '生活日用': 'shopping',
  '休闲玩乐': 'entertainment',
  '学习': 'education',
  '运动': 'health',
  '其他': 'other',
  '退款': 'other',
  '养娃': 'other',
  '金融保险': 'other',
}

// Alipay categories with no good existing home — created as custom
// categories on first import (and reused by name on subsequent imports).
const NEW_CATEGORY_DEFS = {
  '生活服务': { name: 'Life Services', color: '#0d9aff' },
  '酒店旅行': { name: 'Travel', color: '#f97316' },
  '转账':    { name: 'Transfers', color: '#64748b' },
}

/**
 * Parse raw (already GB18030-decoded) CSV text into row objects.
 * Throws if the expected header line can't be found.
 */
export function parseAlipayCsv(text) {
  const lines = text.split(/\r?\n/)
  const headerIdx = lines.findIndex(l => l.startsWith(HEADER_PREFIX))
  if (headerIdx === -1) {
    throw new Error('Could not find the Alipay cashbook header row — is this the right file?')
  }

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || !line.trim()) continue
    const cols = line.split(',')
    if (cols.length < 8) continue // malformed/short line — skip rather than crash

    const time = cols[0].trim()
    const rawCategory = cols[1].trim()
    const kind = cols[2].trim()
    const amountRaw = cols[3].trim()
    const note = cols[4].trim()
    const account = cols[5].trim()

    if (!time) continue
    if (kind === EXCLUDED_KIND) continue

    const amount = parseFloat(amountRaw.replace(FULLWIDTH_COMMA, ''))
    if (!amount || isNaN(amount) || amount <= 0) continue

    rows.push({
      date: time.split(' ')[0],
      desc: translateDesc(note || rawCategory),
      amount,
      type: kind === '收入' ? 'income' : 'expense',
      rawCategory,
      account,
      sourceKey: `alipay|${time}|${amountRaw}|${note}`,
    })
  }
  return rows
}

/**
 * Resolve every distinct raw category in `rows` to a Finance category id,
 * creating new custom categories as needed (reusing one by name if it
 * already exists from a previous import, rather than creating a duplicate).
 *
 * Returns { newCategories: [...], assignment: Map(rawCategory -> categoryId) }
 */
export function resolveCategoriesForImport(rows, existingCategories) {
  const idByName = new Map(existingCategories.map(c => [c.name, c.id]))
  const newCategories = []
  const assignment = new Map()
  const usedRaw = new Set(rows.map(r => r.rawCategory))

  for (const raw of usedRaw) {
    const mappedId = CATEGORY_MAP[raw]
    if (mappedId) { assignment.set(raw, mappedId); continue }

    const def = NEW_CATEGORY_DEFS[raw]
    if (def) {
      const existingId = idByName.get(def.name)
      if (existingId) { assignment.set(raw, existingId); continue }
      const cat = { id: uid('cat'), name: def.name, color: def.color, builtin: false }
      newCategories.push(cat)
      idByName.set(def.name, cat.id) // so a second occurrence in this same import reuses it
      assignment.set(raw, cat.id)
      continue
    }

    assignment.set(raw, 'other') // unrecognized category — shouldn't normally hit this
  }
  return { newCategories, assignment }
}

/**
 * Build final transaction objects from parsed rows, deduped against
 * existing transactions by sourceKey.
 *
 * Returns { toInsert: [...], skipped: number }
 */
export function buildImportTransactions(rows, assignment, existingTransactions) {
  const existingKeys = new Set(existingTransactions.filter(t => t.sourceKey).map(t => t.sourceKey))
  const toInsert = []
  let skipped = 0

  for (const r of rows) {
    if (existingKeys.has(r.sourceKey)) { skipped++; continue }
    toInsert.push({
      id: uid('tx'),
      date: r.date,
      desc: r.desc,
      amount: r.amount,
      type: r.type,
      categoryId: assignment.get(r.rawCategory) || 'other',
      tags: r.account ? ['alipay', r.account] : ['alipay'],
      source: 'alipay',
      sourceKey: r.sourceKey,
    })
  }
  return { toInsert, skipped }
}

/**
 * Decode raw file bytes (GB18030) and run the full parse -> categorize ->
 * dedup pipeline in one call. Convenience wrapper for the UI layer.
 *
 * `translateOptions` — { enabled: bool, apiKey: string } — when enabled and
 * a key is present, any transaction whose description still contains
 * Chinese characters after the offline dictionary pass (translateDesc) is
 * sent to the Google Translation API as a fallback. Off by default; the
 * offline pass always runs regardless.
 */
export async function importAlipayFile(file, existingCategories, existingTransactions, translateOptions = {}) {
  const buf = await file.arrayBuffer()
  const text = new TextDecoder('gb18030').decode(buf)
  const rows = parseAlipayCsv(text)
  const { newCategories, assignment } = resolveCategoriesForImport(rows, existingCategories)
  const { toInsert, skipped } = buildImportTransactions(rows, assignment, existingTransactions)

  let apiTranslated = 0
  if (translateOptions.enabled && translateOptions.apiKey) {
    const needsApi = toInsert.filter(t => CHINESE_RE.test(t.desc))
    if (needsApi.length) {
      const translated = await translateBatch(needsApi.map(t => t.desc), translateOptions.apiKey)
      needsApi.forEach((t, i) => {
        if (translated[i] && translated[i] !== t.desc) { t.desc = translated[i]; apiTranslated++ }
      })
    }
  }

  return { newCategories, toInsert, skipped, totalParsed: rows.length, apiTranslated }
}
