import { useState } from 'react'
import SelectMenu from '../../components/SelectMenu'
import { generateId } from '../../utils/ids'
import { NUMBER_DEFAULT_MODE } from '../../utils/sectionDefaults'

const DEFAULT_SECTION_COLOR = '#7c6aff'

// Creates a new (optional) section; `onAdd` receives it and the form starts over.
export default function AddSectionForm({ nextOrder, onAdd }) {
  const [type, setType] = useState('text')
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [color, setColor] = useState(DEFAULT_SECTION_COLOR)
  const [numberDefaultMode, setNumberDefaultMode] = useState(NUMBER_DEFAULT_MODE.MANUAL)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!name.trim()) return
    await onAdd({
      id: generateId(),
      name: name.trim(),
      type,
      unit: type === 'number' ? unit.trim() : '',
      numberDefaultMode: type === 'number' ? numberDefaultMode : undefined,
      color,
      resident: false,
      order: nextOrder
    })
    setName('')
    setUnit('')
    setColor(DEFAULT_SECTION_COLOR)
    setNumberDefaultMode(NUMBER_DEFAULT_MODE.MANUAL)
  }

  return (
    <form className="add-section-form" onSubmit={handleSubmit}>
      <div className="add-section-type">
        <SelectMenu
          ariaLabel="版块类型"
          options={[{ value: 'text', label: '文字' }, { value: 'number', label: '数字' }]}
          value={type}
          onChange={setType}
        />
      </div>
      <label className="color-swatch-btn color-swatch-btn--lg" title="设定版块主题色" style={{ '--swatch-color': color }}>
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          tabIndex={-1}
        />
        <span className="color-swatch-circle" style={{ background: color }} />
      </label>
      <input
        className="input flex-1"
        placeholder="版块名称 (如: 阅读, 体重...)"
        value={name}
        onChange={e => setName(e.target.value)}
        required
      />
      {type === 'number' && (
        <>
          <input
            className="input"
            placeholder="单位 (如: kg, min)"
            value={unit}
            onChange={e => setUnit(e.target.value)}
            style={{ width: 100 }}
          />
          <div className="section-default-mode-select">
            <SelectMenu
              ariaLabel="数字默认填充方式"
              options={[
                { value: NUMBER_DEFAULT_MODE.MANUAL, label: '每日手动输入，默认 0' },
                { value: NUMBER_DEFAULT_MODE.CARRY, label: '延续前一日数据' }
              ]}
              value={numberDefaultMode}
              onChange={setNumberDefaultMode}
            />
          </div>
        </>
      )}
      <button className="btn btn-secondary" type="submit">添加版块</button>
    </form>
  )
}
