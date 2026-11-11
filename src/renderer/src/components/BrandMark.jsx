import React from 'react'

// The Tessera mark: tiles laid into a T, the last one set slightly askew in a warm colour. It is
// drawn in the current text colour (the accent where it is used), so it follows every theme; the
// standalone artwork with the fixed brand colours is assets/brand/tessera-mark.svg.
export default function BrandMark({ size = 20, className = '' }) {
  return (
    <svg
      className={`brand-mark ${className}`.trim()}
      viewBox="44 48 168 168"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="54" y="58" width="44" height="44" rx="9" fill="currentColor" opacity="0.85" />
      <rect x="106" y="58" width="44" height="44" rx="9" fill="currentColor" opacity="0.6" />
      <rect x="158" y="58" width="44" height="44" rx="9" fill="currentColor" />
      <rect x="106" y="110" width="44" height="44" rx="9" fill="currentColor" opacity="0.75" />
      <rect x="106" y="162" width="44" height="44" rx="9" fill="#d9774a" transform="rotate(4 128 184)" />
    </svg>
  )
}
