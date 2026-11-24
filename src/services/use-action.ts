import { useState } from 'react'
import { toast } from 'react-toastify'
import { useAuth } from '@/services/auth-context'
import { ServiceError, errorMessage, mustReview, requiresSessionRefresh } from '@/services/errors'

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
      if (message) toast.success(message)
      return true
    } catch (e) {
      if (e instanceof ServiceError && e.status === 401) signedOut(e.message)
      if (requiresSessionRefresh(e)) void refresh()
      const err = e instanceof Error ? e : new Error(errorMessage(e))
      setError(err)
      if (mustReview(e) || (e instanceof ServiceError && [409, 412, 429].includes(e.status))) {
        toast.warn(err.message)
      } else {
        toast.error(err.message)
      }
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
