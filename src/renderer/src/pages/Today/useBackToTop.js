import { useCallback, useState } from 'react'

const BACK_TO_TOP_THRESHOLD = 320

// The "back to top" button appears once the page is scrolled a little way down.
export function useBackToTop(contentRef) {
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback((event) => {
    const reveal = event.currentTarget.scrollTop > BACK_TO_TOP_THRESHOLD
    setVisible(prev => (prev === reveal ? prev : reveal))
  }, [])

  const scrollToTop = useCallback(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [contentRef])

  return { visible, handleScroll, scrollToTop }
}
