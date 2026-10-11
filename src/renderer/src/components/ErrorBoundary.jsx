import React from 'react'
import './ErrorBoundary.css'

export function ErrorFallback({ error, onRetry, onHome }) {
  const detail = String(error?.message || error || '未知错误').slice(0, 300)
  return (
    <div className="error-boundary" role="alert">
      <span className="error-boundary-icon" aria-hidden="true">⚠</span>
      <h2 className="error-boundary-title">这个页面出错了</h2>
      <p className="error-boundary-desc">
        已保存的记录不受影响。可以重试，或回到记录页继续使用；如果问题反复出现，请重启软件。
      </p>
      <code className="error-boundary-detail">{detail}</code>
      <div className="error-boundary-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>重试</button>
        {onHome && <button type="button" className="btn btn-ghost" onClick={onHome}>回到记录页</button>}
      </div>
    </div>
  )
}

/**
 * Keeps a render error on one page from unmounting the whole window. Without it the
 * custom title bar disappears too, leaving a frameless window that cannot be closed.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.retry = this.retry.bind(this)
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
  }

  componentDidUpdate(previousProps) {
    // Navigating to another page clears the error.
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  retry() {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} onRetry={this.retry} onHome={this.props.onHome} />
    }
    return this.props.children
  }
}
