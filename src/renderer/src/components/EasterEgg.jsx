import React, { useEffect, useRef, useCallback } from 'react'
import './EasterEgg.css'

// Emoji pool for the easter egg
const EMOJIS = ['❤️', '🐷', '🐶', '✨', '❤️', '❤️', '✨', '🐷']
const CONFETTI_COLORS = [
  '#ff6b9d', '#ff9ecd', '#ffd6e7',
  '#c084fc', '#a855f7', '#f472b6',
  '#fb7185', '#fbbf24', '#34d399',
  '#60a5fa', '#f97316'
]

function rand(min, max) {
  return Math.random() * (max - min) + min
}

export default function EasterEgg({ active }) {
  const containerRef = useRef(null)
  const timersRef = useRef([])

  const clearAll = useCallback(() => {
    timersRef.current.forEach(t => clearTimeout(t))
    timersRef.current = []
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }
  }, [])

  const spawnEmoji = useCallback((container) => {
    const el = document.createElement('div')
    el.className = 'ee-emoji'
    el.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    el.style.cssText = `
      left: ${rand(5, 95)}%;
      bottom: -40px;
      font-size: ${rand(20, 38)}px;
      animation-duration: ${rand(2.5, 4.5)}s;
      animation-delay: ${rand(0, 0.5)}s;
    `
    container.appendChild(el)
    // Remove after animation
    const t = setTimeout(() => el.remove(), 5500)
    timersRef.current.push(t)
  }, [])

  const spawnConfetti = useCallback((container) => {
    const el = document.createElement('div')
    el.className = 'ee-confetti'
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    const isLong = Math.random() > 0.5
    el.style.cssText = `
      left: ${rand(0, 100)}%;
      top: -10px;
      width: ${isLong ? rand(3, 5) : rand(6, 10)}px;
      height: ${isLong ? rand(12, 20) : rand(6, 10)}px;
      background: ${color};
      border-radius: ${isLong ? '2px' : '50%'};
      transform: rotate(${rand(0, 360)}deg);
      animation-duration: ${rand(2, 4)}s;
      animation-delay: ${rand(0, 1)}s;
    `
    container.appendChild(el)
    const t = setTimeout(() => el.remove(), 5500)
    timersRef.current.push(t)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    clearAll()
    if (!active) return

    // Burst: spawn a wave of emojis and confetti
    const spawn = () => {
      for (let i = 0; i < 6; i++) spawnEmoji(container)
      for (let i = 0; i < 18; i++) spawnConfetti(container)
    }

    spawn()
    // Second wave
    const t1 = setTimeout(spawn, 800)
    // Third wave
    const t2 = setTimeout(spawn, 1800)
    timersRef.current.push(t1, t2)

    return clearAll
  }, [active, spawnEmoji, spawnConfetti, clearAll])

  return <div ref={containerRef} className="easter-egg-layer" aria-hidden="true" />
}
