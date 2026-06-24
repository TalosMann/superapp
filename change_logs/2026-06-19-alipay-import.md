# 2026-06-19 — Alipay statement import

## Summary

Adds a CSV import flow for Alipay's "cashbook" (记账本) export into the
Finance module, plus an honest note on the original ask for direct
Alipay/WeChat API integration.

## On API integration

Not pursued — Alipay Open Platform and WeChat Pay's API are merchant/business
developer products for receiving payments and querying a business's own
transaction records. Neither has a consumer-facing endpoint for an individual
to pull their own personal bill history programmatically. The manual
export → import flow built here is the realistic long-term workflow, not a
stopgap until an API becomes available.

## WeChat

No importer built — WeChat transactions will be entered manually via the
existing "Add Transaction" flow. The WeChat xlsx export was inspected during
scoping (100 transactions, no categories, clean transaction-log format) but
parsing it isn't built. If wanted later: needs SheetJS (`xlsx` npm package)
for in-browser .xlsx parsing — not added now since nothing in this stage uses
it, keeping the bundle lean.

## New file

```
src/sections/finance/importAlipay.js
```

`parseAlipayCsv(text)`, `resolveCategoriesForImport(rows, categories)`,
`buildImportTransactions(rows, assignment, existingTransactions)`, and the
convenience wrapper `importAlipayFile(file, categories, transactions)`.

## Format notes (from the real export inspected during scoping)

- **Encoding: GB18030, not UTF-8.** Decoded via `TextDecoder('gb18030')`
  (supported natively in Chromium/Android WebView — no decoding library
  needed).
- **Preamble varies in length** — a multi-line Chinese disclaimer precedes the
  real header row. Parser scans for the line starting `记录时间,分类,收支类型`
  rather than assuming a fixed skip count, so it survives Alipay changing the
  disclaimer wording between export versions.
- **Full-width commas in amounts** — `1，000.00` instead of `1,000.00`.
  Stripped before `parseFloat`. Also used inside note text for multi-item
  lists, which is why a fixed 9-field comma split is safe here (note text
  doesn't use ASCII commas).
- **收支类型 has three values, not two** — 收入 (income), 支出 (expense), and
  不计收支 ("doesn't count as income/expense": balance top-ups, withdrawals,
  refunds). The third is excluded entirely — Personal's transaction model only
  has income/expense.

## Category mapping

| Alipay category | Maps to |
|---|---|
| 餐饮 | Food & Dining |
| 交通 | Transport |
| 购物, 穿搭美容, 生活日用 | Shopping |
| 休闲玩乐 | Entertainment |
| 学习 | Education |
| 运动 | Health |
| 其他, 退款, 养娃, 金融保险 | Other |
| 生活服务 | **Life Services** *(new custom category)* |
| 酒店旅行 | **Travel** *(new custom category)* |
| 转账 | **Transfers** *(new custom category — person-to-person money movement, distinct from spending)* |

New categories are created once and reused by name on subsequent imports
(checked by name before creating a duplicate).

## Dedup across repeated imports

Every imported transaction gets `source: 'alipay'` and a `sourceKey` built
from `alipay|<exact timestamp>|<raw amount string>|<note>`. Each import
checks new rows against existing transactions' `sourceKey`s and silently
skips matches — re-uploading a monthly export whose date range overlaps a
previous one is safe and won't duplicate transactions. No separate "already
imported" log is kept; the existing transaction list is itself the source of
truth for dedup.

## UI

New card in Finance → Settings, above the existing Categories card: "Import
Alipay statement" with a file picker (`accept=".csv"`). No review/preview
step before committing — matches the app's existing direct-action pattern
(same as CSV export, unlike the destructive two-step-confirm Danger Zone).
Result is a single summary toast: counts of transactions added, skipped as
duplicates, and new categories created.

## Verified against the real export

Tested the parsing logic directly against the uploaded file before wiring it
into the UI: 254 total rows → 245 imported (9 correctly excluded as
不计收支), all 14 distinct Chinese categories resolved with no unmapped
fallthrough, zero duplicate sourceKeys generated within a single file.

## Files changed

- **New:** `src/sections/finance/importAlipay.js`
- **Modified:** `src/sections/finance/Finance.jsx` — import handler wired into
  root component, new Settings card

## Android note

No new native dependencies. `TextDecoder('gb18030')` and `file.arrayBuffer()`
are standard Web APIs, supported in Capacitor's Android WebView (Chromium-based).
