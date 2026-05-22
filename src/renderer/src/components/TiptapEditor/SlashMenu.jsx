import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export const SlashMenuView = forwardRef(function SlashMenuView({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef   = useRef(null)
  const itemRefs       = useRef([])

  // Reset index & refs when items change
  useEffect(() => {
    setSelectedIndex(0)
    itemRefs.current = itemRefs.current.slice(0, items.length)
  }, [items])

  // Bug Fix 1 — scroll selected item into view whenever index changes
  useEffect(() => {
    const container = containerRef.current
    const item      = itemRefs.current[selectedIndex]
    if (!container || !item) return

    const containerTop    = container.scrollTop
    const containerBottom = containerTop + container.clientHeight
    const itemTop         = item.offsetTop
    const itemBottom      = itemTop + item.offsetHeight

    if (itemTop < containerTop) {
      // Item is above visible area — scroll up
      container.scrollTop = itemTop
    } else if (itemBottom > containerBottom) {
      // Item is below visible area — scroll down
      container.scrollTop = itemBottom - container.clientHeight
    }
  }, [selectedIndex])

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
    <div className="slash-menu" ref={containerRef}>
      <div className="slash-menu-header">格式</div>
      {items.map((item, index) => (
        <button
          key={index}
          ref={el => { itemRefs.current[index] = el }}
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
