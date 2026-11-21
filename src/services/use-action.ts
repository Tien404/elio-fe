import { useState } from 'react'
import { useAuth } from '@/services/auth-context'
import { ServiceError, errorMessage, requiresSessionRefresh } from '@/services/errors'

export function useAction() {
  const { signedOut, refresh } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [success, setSuccess] = useState('')
  async function run<T>(operation: () => Promise<T>, done?: (result: T) => void, message = '') {
    setPending(true)
    setError(null)
    setSuccess('')
    try {
      const result = await operation()
      done?.(result)
      setSuccess(message)
      return true
    } catch (e) {
      if (e instanceof ServiceError && e.status === 401) signedOut(e.message)
      if (requiresSessionRefresh(e)) void refresh()
      setError(e instanceof Error ? e : new Error(errorMessage(e)))
      return false
    } finally {
      setPending(false)
    }
  }
  return {
    pending,
    error,
    success,
    run,
    clear() {
      setError(null)
      setSuccess('')
    },
  }
}
