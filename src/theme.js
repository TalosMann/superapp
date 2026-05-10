/**
 * theme.js — Unified design tokens for the Personal super-app.
 *
 * Merges the slate palette from Timetable with the navy/cyan accent
 * from TalosFinance into a single coherent dark theme.
 */

export const T = {
  // Backgrounds
  bg:        '#060b14',  // page background (deepest)
  bg2:       '#0c1422',  // card background
  bg3:       '#162033',  // raised / hover
  border:    '#1e2c42',  // subtle border
  borderHi:  '#2a3a55',  // emphasized border

  // Text
  text:      '#dde6f0',  // primary
  text2:     '#94a3b8',  // secondary
  text3:     '#64748b',  // tertiary / labels
  text4:     '#475569',  // hints / disabled

  // Accents — module-coded for instant recognition
  accent:    '#06c6d4',  // primary accent (cyan) — finance heritage
  accent2:   '#0d9aff',  // secondary accent (blue)
  timetable: '#818CF8',  // indigo — timetable
  finance:   '#06c6d4',  // cyan — finance
  nutrition: '#f59e0b',  // amber — nutrition
  gym:       '#ef4444',  // red — gym
  goals:     '#34d399',  // green — goals
  badges:    '#fbbf24',  // gold — badges

  // Semantic
  good:      '#34d399',
  ok:        '#fbbf24',
  warn:      '#fb923c',
  bad:       '#ef4444',
  info:      '#0d9aff',

  // Macros (nutrition-specific)
  cal:       '#f59e0b',
  protein:   '#ec4899',
  weight:    '#8b5cf6',
}

// ── Common style fragments ───────────────────────────────────────────────────

export const S = {
  screen: {
    display: 'flex', flexDirection: 'column', height: '100%',
    background: T.bg, color: T.text, overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center',
    padding: '14px 16px 8px', gap: 8, flexShrink: 0,
  },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-.3px' },
  scroll: { flex: 1, overflowY: 'auto', padding: '4px 16px 96px' },
  card: {
    background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  cardRaised: {
    background: T.bg3, border: `1px solid ${T.borderHi}`, borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  iconBtn: {
    background: 'none', border: 'none', color: T.text2, cursor: 'pointer',
    padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  label: {
    display: 'block', fontSize: 11, fontWeight: 700, color: T.text3,
    textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, marginTop: 14,
  },
  input: {
    width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '12px 14px', color: T.text, fontSize: 15,
    fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  },
  inputMono: {
    width: '100%', background: T.bg2, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '12px 14px', color: T.text, fontSize: 15,
    fontFamily: "'DM Mono', monospace", boxSizing: 'border-box', outline: 'none',
  },
  btnPrimary: {
    width: '100%', background: T.accent, border: 'none', borderRadius: 12,
    padding: 14, color: '#031018', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSecondary: {
    background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10,
    padding: '10px 16px', color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  fab: {
    position: 'absolute', bottom: 84, right: 20, width: 56, height: 56, borderRadius: 28,
    background: T.accent, border: 'none', color: '#031018', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(6,198,212,0.35)', zIndex: 50,
  },
}
