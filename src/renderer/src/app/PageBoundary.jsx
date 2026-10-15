import { Suspense } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'

// A page that throws shows the error screen instead of taking the app down, and recovers when
// the route changes. Lazily loaded pages wait behind an empty placeholder.
export default function PageBoundary({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <ErrorBoundary resetKey={location.pathname} onHome={() => navigate('/today')}>
      <Suspense fallback={<div className="page-loading" aria-busy="true" />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
