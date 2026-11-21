import { useCallback, useEffect, useState } from 'react'
import { requiresSessionRefresh, ServiceError } from '@/services/errors'
import { useAuth } from '@/services/auth-context'

export function useResource<T>(
  load: () => Promise<T>,
  key: string,
  { retainOnError = false }: { retainOnError?: boolean } = {},
) {
  const { signedOut, refresh } = useAuth()
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; revision: number; data?: T; error?: Error }>()
  useEffect(() => {
    let active = true
    void load()
      .then((data) => {
        if (active) setResult({ key, revision, data })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ServiceError && error.status === 401) signedOut(error.message)
        if (requiresSessionRefresh(error)) void refresh()
        setResult((previous) => ({
          key,
          revision,
          data: retainOnError && previous?.key === key ? previous.data : undefined,
          error: error instanceof Error ? error : new Error('Unable to load this resource.'),
        }))
      })
    return () => {
      active = false
    }
  }, [load, key, revision, signedOut, refresh, retainOnError])
  useEffect(() => {
    const update = () => setRevision((n) => n + 1)
    window.addEventListener('elio:data', update)
    window.addEventListener('storage', update)
    return () => {
      window.removeEventListener('elio:data', update)
      window.removeEventListener('storage', update)
    }
  }, [])
  const reload = useCallback(() => setRevision((n) => n + 1), [])
  const same = result?.key === key
  return {
    data: same ? result?.data : undefined,
    error: same ? result?.error : undefined,
    loading: !same || result?.revision !== revision,
    reload,
  }
}
