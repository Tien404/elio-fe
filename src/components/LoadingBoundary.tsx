import { useCallback, useState, type ReactNode } from 'react'
import { LoadingContext } from '@/services/loading-context'

export function Spinner() {
  return (
    <div className="loading-state" role="status" aria-label="Loading">
      <span className="spinner" aria-hidden="true" />
    </div>
  )
}

export function LoadingBoundary({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Set<string>>(() => new Set())
  const register = useCallback((id: string) => {
    setRequests((previous) => new Set(previous).add(id))
    return () =>
      setRequests((previous) => {
        const next = new Set(previous)
        next.delete(id)
        return next
      })
  }, [])
  const busy = requests.size > 0
  return (
    <LoadingContext.Provider value={register}>
      <div className="loading-boundary" aria-busy={busy}>
        {children}
        {busy && (
          <div className="loading-overlay">
            <Spinner />
          </div>
        )}
      </div>
    </LoadingContext.Provider>
  )
}
