/**
 * GoalCard.jsx — Single goal row. Renders checkbox or counter based on kind.
 */

import { T, S } from '../../theme.js'
import { ProgressBar } from '../../shared.jsx'
import Icon from '../../Icon.jsx'
import { TIER_BY_ID } from './data.js'

export default function GoalCard({ goal, onToggle, onIncrement, onDecrement, onEdit }) {
  const tier = TIER_BY_ID[goal.tier]
  const done = goal.kind === 'check'
    ? goal.checkedAt != null
    : (goal.progress || 0) >= goal.target

  return (
    <div onClick={onEdit} style={{
      background: T.bg2, border: `1px solid ${done ? T.good : T.border}`,
      borderRadius: 12, padding: 12, marginBottom: 8,
      cursor: 'pointer', position: 'relative',
      opacity: done ? 0.75 : 1,
      transition: 'all .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Checkbox or counter control */}
        {goal.kind === 'check' ? (
          <button onClick={(e) => { e.stopPropagation(); onToggle() }} style={{
            width: 26, height: 26, borderRadius: 13, flexShrink: 0,
            border: `2px solid ${done ? T.good : T.border}`,
            background: done ? T.good : 'transparent',
            color: '#0a0e15', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginTop: 1,
          }}>
            {done && <Icon name="check" size={14} stroke={3} />}
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginTop: 1,
          }}>
            <button onClick={(e) => { e.stopPropagation(); onDecrement() }} disabled={!goal.progress}
              style={{
                width: 24, height: 24, borderRadius: 12, padding: 0,
                border: `1px solid ${T.border}`, background: T.bg3, color: T.text2,
                cursor: goal.progress ? 'pointer' : 'not-allowed',
                opacity: goal.progress ? 1 : 0.4,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              }}>−</button>
            <button onClick={(e) => { e.stopPropagation(); onIncrement() }} disabled={done}
              style={{
                width: 24, height: 24, borderRadius: 12, padding: 0,
                border: 'none', background: done ? T.good : tier.color, color: '#0a0e15',
                cursor: done ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
              }}>
              {done ? <Icon name="check" size={14} stroke={3} /> : '+'}
            </button>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: T.text,
            textDecoration: done ? 'line-through' : 'none',
            opacity: done ? 0.7 : 1,
          }}>
            {goal.title}
          </div>

          {/* Counter progress bar */}
          {goal.kind === 'counter' && (
            <div style={{ marginTop: 8 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 11, color: T.text3, marginBottom: 4,
              }}>
                <span className="mono">{goal.progress || 0} / {goal.target}</span>
                <span>{Math.round(((goal.progress || 0) / goal.target) * 100)}%</span>
              </div>
              <ProgressBar
                value={goal.progress || 0} max={goal.target}
                color={done ? T.good : tier.color}
                height={4} bg={T.bg3}
              />
            </div>
          )}

          {/* Linked event subtitle */}
          {goal.linkedEventTitle && (
            <div style={{
              fontSize: 11, color: T.timetable, marginTop: 6,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Icon name="calendar" size={11} />
              <span>
                {goal.linkedEventTitle}
                {goal.recurrence === 'count' && goal.recurrenceCount > 1 &&
                  ` · next ${goal.recurrenceCount}×`}
              </span>
            </div>
          )}

          {/* Notes preview */}
          {goal.notes && (
            <div style={{ fontSize: 12, color: T.text3, marginTop: 6, lineHeight: 1.4 }}>
              {goal.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
