import type { Identity, IdentityService, MeView } from '@/services/contracts'
import { acceptIdentity, http, json, currentIdentity } from './http'
import { ServiceError } from '@/services/errors'

export const apiIdentity: IdentityService = {
  async restore() {
    try {
      const result = await http<Identity>('/auth/session')
      acceptIdentity(result)
      return result
    } catch (error) {
      if (error instanceof ServiceError && error.status === 401) {
        acceptIdentity(null)
        return null
      }
      throw error
    }
  },
  async login(input) {
    await http('/auth/sessions', json('POST', input))
    const result = await http<Identity>('/auth/session')
    acceptIdentity(result)
    return result
  },
  async logout() {
    await http('/auth/session', { method: 'DELETE' })
    acceptIdentity(null)
  },
  async updateProfile(displayName, expectedVersion) {
    const me = await http<MeView>('/me', json('PATCH', { displayName }, expectedVersion))
    const old = currentIdentity()!
    const result = { me, session: { ...old.session, account: me.account } }
    acceptIdentity(result)
    return result
  },
  async changePassword(input) {
    await http('/me/password', json('PUT', input))
    acceptIdentity(null)
  },
}
