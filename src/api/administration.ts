import type { AdminService } from '@/services/admin-contracts'
import type { MeView } from '@/services/contracts'
import { allPages, localPage, operationalAudit, pageParams } from './courses'
import { http, json } from './http'

export const apiAdmin: AdminService = {
  async accounts(query = {}) {
    const params = pageParams(query)
    if (query.search?.trim()) params.set('q', query.search.trim())
    if (query.status && query.status !== 'ALL') params.set('status', query.status)
    if (query.role && query.role !== 'ALL') {
      params.delete('page')
      params.delete('pageSize')
      const rows = await allPages<MeView>(
        params.size ? `/admin/accounts?${params}` : '/admin/accounts',
      )
      return localPage(
        rows.filter((row) => row.account.role === query.role),
        query,
      )
    }
    return http(`/admin/accounts?${params}`)
  },
  async provision(input) {
    const me = await http<MeView>('/admin/accounts', json('POST', input))
    return { accountId: me.account.id }
  },
  update(id, { expectedVersion, ...body }) {
    return http(`/admin/accounts/${id}`, json('PATCH', body, expectedVersion))
  },
  async resetPassword(id, reason) {
    await http(`/admin/accounts/${id}/password-reset`, json('POST', { reason }))
    return { accountId: id }
  },
  audit(query = {}) {
    const params = pageParams(query)
    if (query.action?.trim()) params.set('action', query.action.trim().toUpperCase())
    for (const key of ['actorId', 'offeringId', 'fromAt', 'toAt', 'targetType'] as const)
      if (query[key]) params.set(key, String(query[key]))
    return operationalAudit(`/admin/audit-entries?${params}`)
  },
}
