import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { Identity } from '@/services/contracts'
import { services, sessionLifecycle } from '@/services'
import { AuthContext } from '@/services/auth-context'
import { errorMessage, ServiceError } from '@/services/errors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [loading, setLoading] = useState(true)
  const [restoreError, setRestoreError] = useState('')
  const [notice, setNotice] = useState('')
  const signedOut = useCallback((message: string) => {
    setIdentity(null)
    setNotice(message)
  }, [])
  const refresh = useCallback(async () => {
    try {
      const restored = await services.identity.restore()
      setIdentity(restored)
      setRestoreError('')
    } catch (error) {
      if (error instanceof ServiceError && (error.status === 401 || error.status === 403))
        signedOut(error.message)
      else setRestoreError(errorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [signedOut])
  useEffect(() => {
    void services.identity
      .restore()
      .then((restored) => {
        setIdentity(restored)
        setRestoreError('')
      })
      .catch((error: unknown) => {
        if (error instanceof ServiceError && (error.status === 401 || error.status === 403))
          signedOut(error.message)
        else setRestoreError(errorMessage(error))
      })
      .finally(() => setLoading(false))
    const expire = () => signedOut('Your session has expired. Sign in again.')
    return sessionLifecycle.subscribe(() => {
      void refresh()
    }, expire)
  }, [refresh, signedOut])
  useEffect(() => {
    if (!identity) return
    const timer = window.setTimeout(
      () => signedOut('Your session has expired. Sign in again.'),
      Math.max(0, sessionLifecycle.remainingMs(identity.session.absoluteExpiresAt)),
    )
    return () => clearTimeout(timer)
  }, [identity, signedOut])
  return (
    <AuthContext.Provider
      value={{
        identity,
        loading,
        restoreError,
        notice,
        refresh,
        signedOut,
        accept: setIdentity,
        async login(input) {
          const result = await services.identity.login(input)
          setIdentity(result)
          setNotice('')
          setRestoreError('')
        },
        async logout() {
          await services.identity.logout()
          signedOut('You have signed out.')
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
