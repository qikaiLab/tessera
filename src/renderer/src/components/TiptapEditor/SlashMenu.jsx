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

  // Set by the arrow keys only: hovering an item selects it too, and scrolling then would move
  // the items under the pointer and make the list run away from the mouse.
  const scrollToSelectionRef = useRef(false)

  // Keep the item chosen with the arrow keys inside the visible part of the list.
  useEffect(() => {
    if (!scrollToSelectionRef.current) return
    scrollToSelectionRef.current = false
    const container = containerRef.current
    const item      = itemRefs.current[selectedIndex]
    if (!container || !item) return

    // Compare screen rectangles: offsetTop is measured from the nearest positioned ancestor,
    // which is not this scrolling box, so it drifts as soon as the list has scrolled.
    // The sticky header covers the top of the box.
    // The visible area starts inside the border.
    const box        = container.getBoundingClientRect()
    const rect       = item.getBoundingClientRect()
    const header     = container.querySelector('.slash-menu-header')?.offsetHeight || 0
    const topEdge    = box.top + container.clientTop + header
    const bottomEdge = box.top + container.clientTop + container.clientHeight

    if (rect.top < topEdge) container.scrollTop -= topEdge - rect.top
    else if (rect.bottom > bottomEdge) container.scrollTop += rect.bottom - bottomEdge
  }, [selectedIndex])

  const selectItem = (index) => {
    const item = items[index]
    if (item) command(item)
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (!items || items.length === 0) {
        return false
      }
      if (event.key === 'ArrowUp') {
        scrollToSelectionRef.current = true
        setSelectedIndex(i => (i + items.length - 1) % items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        scrollToSelectionRef.current = true
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
