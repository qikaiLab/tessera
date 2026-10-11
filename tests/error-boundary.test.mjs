import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ErrorBoundary, { ErrorFallback } from '../src/renderer/src/components/ErrorBoundary.jsx'

describe('ErrorBoundary', () => {
  it('turns a render error into state so the fallback can replace the page', () => {
    const error = new Error('boom')
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ error })
  })

  it('renders its children while nothing has failed', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorBoundary, null, React.createElement('p', null, '页面内容'))
    )
    expect(html).toBe('<p>页面内容</p>')
  })

  it('offers a retry and a way home without hiding the cause', () => {
    const html = renderToStaticMarkup(
      React.createElement(ErrorFallback, { error: new Error('Cannot read x'), onRetry: () => {}, onHome: () => {} })
    )
    expect(html).toContain('这个页面出错了')
    expect(html).toContain('Cannot read x')
    expect(html).toContain('重试')
    expect(html).toContain('回到记录页')
    expect(html).toContain('role="alert"')
  })

  it('shortens very long error messages', () => {
    const html = renderToStaticMarkup(React.createElement(ErrorFallback, { error: new Error('x'.repeat(2000)) }))
    expect(html.length).toBeLessThan(1500)
  })
})
