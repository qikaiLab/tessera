import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export const SlashMenuView = forwardRef(function SlashMenuView({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Reset index when items change
  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  const selectItem = (index) => {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (!items.length) return null

  return (
    <div className="slash-menu">
      <div className="slash-menu-header">格式</div>
      {items.map((item, index) => (
        <button
          key={index}
          className={`slash-menu-item ${index === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => selectItem(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className="slash-menu-icon">{item.icon}</span>
          <div className="slash-menu-text">
            <span className="slash-menu-title">{item.title}</span>
            <span className="slash-menu-desc">{item.description}</span>
          </div>
        </button>
      ))}
    </div>
  )
})
