/**
 * App.jsx — Personal super-app shell.
 *
 * Stage 5: Home, Timetable, Finance, Nutrition, Goals, and Gym all built.
 * Stage 6: app-wide PIN lock + SQLCipher encryption-at-rest (see
 * LockScreen.jsx, migration.js, pinAuth.js for the actual mechanics and
 * their honest limits — no biometric yet, PIN is an access gate not
 * independent crypto, deliberately deferred per the Stage 6 changelog).
 */

import { useState, useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { T, S } from './theme.js'
import Icon from './Icon.jsx'
import Home from './sections/Home.jsx'
import Nutrition from './sections/Nutrition.jsx'
import Timetable from './sections/timetable/Timetable.jsx'
import Goals from './sections/goals/Goals.jsx'
import Gym from './sections/gym/Gym.jsx'
import Finance from './sections/finance/Finance.jsx'
import LockScreen from './LockScreen.jsx'

const TABS = [
  { id: 'home',      label: 'Home',      icon: 'dashboard', color: T.accent    },
  { id: 'timetable', label: 'Timetable', icon: 'calendar',  color: T.timetable },
  { id: 'finance',   label: 'Finance',   icon: 'wallet',    color: T.finance   },
  { id: 'nutrition', label: 'Nutrition', icon: 'fork',      color: T.nutrition },
  { id: 'gym',       label: 'Gym',       icon: 'dumbbell',  color: T.gym       },
  { id: 'goals',     label: 'Goals',     icon: 'target',    color: T.goals     },
]

const BUILT_TABS = ['home', 'timetable', 'finance', 'nutrition', 'goals', 'gym']
const LOCK_TIMEOUT_MS = 30_000 // re-lock after 30s in the background

export default function App() {
  const [tab, setTab] = useState('home')
  const onNative = Capacitor.isNativePlatform()
  // Web/dev: never locked at all (matches existing storage.js bypass pattern).
  const [unlocked, setUnlocked] = useState(!onNative)
  const bgTimestamp = useRef(null)

  useEffect(() => {
    if (!onNative) return
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        bgTimestamp.current = Date.now()
      } else {
        if (bgTimestamp.current && Date.now() - bgTimestamp.current > LOCK_TIMEOUT_MS) {
          setUnlocked(false)
        }
        bgTimestamp.current = null
      }
    })
    return () => { sub.then(h => h.remove()).catch(() => {}) }
  }, [onNative])

  if (onNative && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {tab === 'home'      && <Home />}
        {tab === 'timetable' && <Timetable />}
        {tab === 'finance'   && <Finance />}
        {tab === 'nutrition' && <Nutrition />}
        {tab === 'gym'       && <Gym />}
        {tab === 'goals'     && <Goals />}
        {!BUILT_TABS.includes(tab) && <Stub tab={tab} />}
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
