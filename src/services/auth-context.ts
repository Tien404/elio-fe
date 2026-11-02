import { createContext, useContext } from 'react'
import type { Identity, LoginRequest } from '@/services/contracts'
export interface AuthState {
  identity: Identity | null
  loading: boolean
  restoreError: string
  notice: string
  refresh(): Promise<void>
  accept(identity: Identity): void
  login(input: LoginRequest): Promise<void>
  logout(): Promise<void>
  signedOut(message: string): void
}
export const AuthContext = createContext<AuthState | null>(null)
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('AuthProvider is required')
  return value
}
