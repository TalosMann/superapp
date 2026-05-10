/**
 * App.jsx — Personal super-app shell.
 *
 * Bottom navigation routes between 6 modules:
 *   Home (incl. Settings/Backup) · Timetable · Finance · Nutrition · Gym · Goals
 *
 * Stage 1: Home (with backup) and Nutrition are fully built.
 * Other tabs are stub screens until their stages.
 */

import { useState } from 'react'
import { T, S } from './theme.js'
import Icon from './Icon.jsx'
import Home from './sections/Home.jsx'
import Nutrition from './sections/Nutrition.jsx'

const TABS = [
  { id: 'home',      label: 'Home',      icon: 'dashboard', color: T.accent    },
  { id: 'timetable', label: 'Timetable', icon: 'calendar',  color: T.timetable },
  { id: 'finance',   label: 'Finance',   icon: 'wallet',    color: T.finance   },
  { id: 'nutrition', label: 'Nutrition', icon: 'fork',      color: T.nutrition },
  { id: 'gym',       label: 'Gym',       icon: 'dumbbell',  color: T.gym       },
  { id: 'goals',     label: 'Goals',     icon: 'target',    color: T.goals     },
]

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {tab === 'home'      && <Home />}
        {tab === 'nutrition' && <Nutrition />}
        {tab !== 'home' && tab !== 'nutrition' && <Stub tab={tab} />}
      </div>

      <div style={{
        display: 'flex', flexShrink: 0, background: T.bg2,
        borderTop: `1px solid ${T.border}`,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
      }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: 'transparent', border: 'none',
              padding: '10px 4px 8px', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              color: active ? t.color : T.text4,
              transition: 'color .15s',
            }}>
              <Icon name={t.icon} size={22} stroke={active ? 2.2 : 1.8} />
              <div style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                letterSpacing: '.02em',
              }}>{t.label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Stub({ tab }) {
  const t = TABS.find(x => x.id === tab)
  return (
    <div style={S.screen}>
      <div style={S.header}>
        <div style={S.headerTitle}>{t.label}</div>
      </div>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16,
      }}>
        <div style={{ color: t.color }}>
          <Icon name={t.icon} size={56} stroke={1.5} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{t.label} module</div>
        <div style={{ fontSize: 14, color: T.text3, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Coming in a future build stage.
        </div>
      </div>
    </div>
  )
}
