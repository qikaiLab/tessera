import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift, size } from '@floating-ui/dom'
import './SelectMenu.css'

/**
 * Themed replacement for the native <select>.
 *
 * options: [{ value, label, hint?, color?, disabled? }]
 * value:   string (single) or string[] (multiple)
 * trigger: optional render prop ({ ref, props, open }) => element for a custom button;
 *          spread `props` onto it and attach `ref`.
 */
export default function SelectMenu({
  options,
  value,
  onChange,
  multiple = false,
  placeholder = '请选择',
  ariaLabel,
  className = '',
  trigger,
  emptyText = '暂无可选项'
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const listId = useId()

  const selected = useMemo(
    () => new Set(multiple ? (value || []) : value === undefined || value === null ? [] : [value]),
    [multiple, value]
  )

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  const openMenu = useCallback(() => {
    const firstSelected = options.findIndex(option => selected.has(option.value) && !option.disabled)
    const firstEnabled = options.findIndex(option => !option.disabled)
    setActiveIndex(firstSelected >= 0 ? firstSelected : firstEnabled)
    setOpen(true)
  }, [options, selected])

  const choose = useCallback((option) => {
    if (option.disabled) return
    if (multiple) {
      const next = selected.has(option.value)
        ? [...selected].filter(item => item !== option.value)
        : [...selected, option.value]
      onChange(next)
    } else {
      onChange(option.value)
      close()
    }
  }, [close, multiple, onChange, selected])

  // Position next to the trigger and keep following it (scroll, resize, layout changes).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return undefined
    const reference = triggerRef.current
    const floating = menuRef.current
    const update = () => computePosition(reference, floating, {
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [
        offset(6),
        flip({ padding: 8 }),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply({ availableHeight, rects, elements }) {
            Object.assign(elements.floating.style, {
              minWidth: `${Math.max(rects.reference.width, 160)}px`,
              maxHeight: `${Math.max(120, Math.min(availableHeight, 288))}px`
            })
          }
        })
      ]
    }).then(({ x, y }) => {
      Object.assign(floating.style, { left: `${x}px`, top: `${y}px` })
    })
    return autoUpdate(reference, floating, update)
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    menuRef.current?.focus({ preventScroll: true })
    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target)) return
      close(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, close])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    menuRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex])

  const moveActive = (direction) => {
    if (!options.some(option => !option.disabled)) return
    let next = activeIndex
    for (let step = 0; step < options.length; step += 1) {
      next = (next + direction + options.length) % options.length
      if (!options[next].disabled) break
    }
    setActiveIndex(next)
  }

  const handleTriggerKeyDown = (event) => {
    if (open) return
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault()
      openMenu()
    }
  }

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveActive(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveActive(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(options.findIndex(option => !option.disabled))
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(options.length - 1 - [...options].reverse().findIndex(option => !option.disabled))
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (options[activeIndex]) choose(options[activeIndex])
    } else if (event.key === 'Tab') {
      close(false)
    }
  }

  const selectedLabel = options.filter(option => selected.has(option.value)).map(option => option.label).join('、')
  const triggerProps = {
    type: 'button',
    'aria-haspopup': 'listbox',
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-label': ariaLabel,
    onClick: () => (open ? close(false) : openMenu()),
    onKeyDown: handleTriggerKeyDown
  }

  return (
    <>
      {trigger ? trigger({ ref: triggerRef, props: triggerProps, open }) : (
        <button
          ref={triggerRef}
          {...triggerProps}
          className={`select-menu-trigger ${open ? 'is-open' : ''} ${className}`}
        >
          <span className={`select-menu-value ${selectedLabel ? '' : 'is-placeholder'}`}>
            {selectedLabel || placeholder}
          </span>
          <span className="select-menu-chevron" aria-hidden="true">▾</span>
        </button>
      )}
      {open && createPortal(
        <div
          ref={menuRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-multiselectable={multiple || undefined}
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          className="dropdown-menu select-menu-popover"
          onKeyDown={handleMenuKeyDown}
        >
          {options.length === 0 ? (
            <div className="select-menu-empty">{emptyText}</div>
          ) : options.map((option, index) => {
            const isSelected = selected.has(option.value)
            return (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                className={`dropdown-item select-menu-option ${isSelected ? 'is-selected' : ''} ${index === activeIndex ? 'is-active' : ''} ${option.disabled ? 'is-disabled' : ''}`}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                <span className="select-menu-check" aria-hidden="true">{isSelected ? '✓' : ''}</span>
                {option.color && <span className="select-menu-dot" style={{ background: option.color }} aria-hidden="true" />}
                <span className="select-menu-label">{option.label}</span>
                {option.hint && <span className="select-menu-hint">{option.hint}</span>}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </>
  )
}
