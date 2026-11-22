import React, { useRef } from 'react'
import Presence from './Presence'
import './Unfold.css'

/**
 * A block that opens to its height when it appears and folds shut when it goes, in the flow of the
 * page (what is below it slides with it). It keeps its content for the fold, like Presence.
 *
 *   <Unfold show={editing}>{editing && <Editor />}</Unfold>
 *
 * It starts open, without the opening, when it is already shown on the first render. Nothing
 * waits for an animation to end: the content is removed on a timer, so a window that never plays
 * animations (in the background) ends up in the same place.
 *
 * Its height is animated directly (0 <-> auto, which needs interpolate-size). A grid row that goes
 * 0fr <-> 1fr looks the same but leaves a gap while it runs: the box takes the fraction of the content,
 * and the row inside takes that fraction of the box again.
 *
 * It never fades itself (a fading ancestor flattens the glass inside it); style what it holds. The
 * content gets a few pixels of room all round, so rings and shadows are not cut off by the clip.
 */
export default function Unfold({ show, children, duration = 260, className = '' }) {
  const still = useRef(show)
  if (!show) still.current = false

  return (
    <Presence duration={duration}>
      {show && (
        <div className={`unfold ${still.current ? 'is-still' : ''} ${className}`} style={{ '--unfold-ms': `${duration}ms` }}>
          <div className="unfold-body">{children}</div>
        </div>
      )}
    </Presence>
  )
}
