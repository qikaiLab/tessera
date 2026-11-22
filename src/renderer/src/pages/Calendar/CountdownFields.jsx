import { useEffect, useId, useRef } from 'react'
import { COUNTDOWN_COLORS, MAX_DATE, MAX_NAME_LENGTH, MAX_NOTE_LENGTH, MIN_DATE } from '../../utils/countdowns'
import { useSlidingThumb } from '../../utils/useSlidingThumb'
import { cleanEvery } from './countdownDraft'

const REPEAT_OPTIONS = [
  { unit: '', label: '不重复' },
  { unit: 'week', label: '每周' },
  { unit: 'month', label: '每月' },
  { unit: 'year', label: '每年' }
]
const EVERY_UNIT_TEXT = { week: '周', month: '个月', year: '年' }

function FieldError({ id, message }) {
  return message ? <p id={id} className="cd-error" role="alert">{message}</p> : null
}

/**
 * The controls of one countdown: name, date, repeat, colour and note. It only shows and reports
 * (`onChange({ field: value })`); the form that holds it decides when a change is kept.
 *
 *   problems     what is wrong per field ('' when fine), shown under the field
 *   onFieldBlur  called with the field name when it loses focus
 *   noteRows     a multi-line note when set, a one-line one otherwise
 */
export default function CountdownFields({ draft, problems, onChange, onFieldBlur, noteRows = 0, focusName = false }) {
  const id = useId()
  const nameRef = useRef(null)
  const repeatThumbRef = useSlidingThumb()
  const ids = (field) => `${id}-${field}`

  useEffect(() => {
    if (focusName) nameRef.current?.focus({ preventScroll: true })
  }, [focusName])

  const NoteControl = noteRows ? 'textarea' : 'input'

  return (
    <div className="cd-fields">
      <div className="cd-field">
        <label htmlFor={ids('name')}>名称</label>
        <input
          id={ids('name')}
          ref={nameRef}
          className="input"
          value={draft.name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="例如：生日、考试、出发日"
          aria-invalid={problems.name ? 'true' : undefined}
          aria-describedby={problems.name ? ids('name-error') : undefined}
          onChange={event => onChange({ name: event.target.value })}
          onBlur={() => onFieldBlur?.('name')}
        />
        <FieldError id={ids('name-error')} message={problems.name} />
      </div>

      <div className="cd-field">
        <label htmlFor={ids('date')}>{draft.unit ? '起始日期' : '日期'}</label>
        <input
          id={ids('date')}
          type="date"
          className="input"
          value={draft.date}
          min={MIN_DATE}
          max={MAX_DATE}
          aria-invalid={problems.date ? 'true' : undefined}
          aria-describedby={problems.date ? ids('date-error') : undefined}
          onChange={event => onChange({ date: event.target.value })}
          onBlur={() => onFieldBlur?.('date')}
        />
        <FieldError id={ids('date-error')} message={problems.date} />
      </div>

      <div className="cd-field">
        <span className="cd-label" id={ids('repeat')}>重复</span>
        <div className="cd-seg" role="radiogroup" aria-labelledby={ids('repeat')} ref={repeatThumbRef}>
          {REPEAT_OPTIONS.map(option => (
            <button
              key={option.unit || 'none'}
              type="button"
              role="radio"
              aria-checked={draft.unit === option.unit}
              className={`cd-seg-btn ${draft.unit === option.unit ? 'active' : ''}`}
              onClick={() => onChange({ unit: option.unit })}
            >
              {option.label}
            </button>
          ))}
        </div>
        {draft.unit && (
          <div className="cd-every">
            <span>每</span>
            <input
              className="input cd-every-input"
              inputMode="numeric"
              aria-label="重复间隔"
              value={draft.every}
              aria-invalid={problems.every ? 'true' : undefined}
              aria-describedby={problems.every ? ids('every-error') : undefined}
              onChange={event => onChange({ every: cleanEvery(event.target.value) })}
              onBlur={() => onFieldBlur?.('every')}
            />
            <span>{EVERY_UNIT_TEXT[draft.unit]}重复一次</span>
          </div>
        )}
        <FieldError id={ids('every-error')} message={problems.every} />
      </div>

      <div className="cd-field">
        <span className="cd-label" id={ids('color')}>颜色</span>
        <div className="cd-swatches" role="group" aria-labelledby={ids('color')}>
          {COUNTDOWN_COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={`cd-swatch ${draft.color === color ? 'on' : ''}`}
              style={{ '--swatch': color }}
              aria-label={`颜色 ${color}`}
              aria-pressed={draft.color === color}
              onClick={() => onChange({ color })}
            />
          ))}
        </div>
      </div>

      <div className="cd-field">
        <label htmlFor={ids('note')}>备注（可选）</label>
        <NoteControl
          id={ids('note')}
          className="input cd-note"
          value={draft.note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="例如：提前订票"
          {...(noteRows ? { rows: noteRows } : {})}
          onChange={event => onChange({ note: event.target.value })}
        />
      </div>
    </div>
  )
}
