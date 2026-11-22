import type { Offering } from '@/services/contracts'
import type { InboxView, PersonalQuery, PersonalService } from '@/services/personal-contracts'
import { vietnamDayBoundary } from '@/services/assessment-time'
import { ServiceError } from '@/services/errors'
import { allPages, pageParams } from './courses'
import { getDashboard } from './dashboard'
import { http } from './http'

function scopedParams(query: PersonalQuery) {
  const params = pageParams(query)
  if (query.offeringId) params.set('offeringId', String(query.offeringId))
  if (query.kind && query.kind !== 'ALL') params.set('kind', query.kind)
  if (query.state && query.state !== 'ALL') params.set('state', query.state)
  if (query.search?.trim()) params.set('search', query.search.trim())
  return params
}

export const apiPersonal: PersonalService = {
  async summary() {
    const [inbox, sections] = await Promise.all([
      apiPersonal.inbox({ pageSize: 1 }),
      allPages<Offering>('/offerings'),
    ])
    return {
      unread: inbox.unread,
      semesters: [...new Set(sections.map((section) => section.semester))],
    }
  },
  dashboard: getDashboard,
  inbox: (query = {}) => http<InboxView>(`/me/notifications?${scopedParams(query)}`),
  read: (id) => http<void>(`/me/notifications/${id}/read`, { method: 'PUT' }),
  async destination(notification) {
    const { href, targetKind, targetId } = notification
    if (!href?.startsWith('/') || href.startsWith('//') || /[\\\r\n]/.test(href))
      return { href: null }
    return {
      href: targetKind === 'ANNOUNCEMENT' ? `${href}?announcementId=${targetId}` : href,
    }
  },
  async calendar(query = {}) {
    const params = scopedParams(query)
    const from = query.from ? vietnamDayBoundary(query.from) : null
    const to = query.to ? vietnamDayBoundary(query.to, true) : null
    if ((query.from && !from) || (query.to && !to))
      throw new ServiceError(400, 'Enter a valid calendar date.')
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return http(`/me/calendar?${params}`)
  },
  progress: (id, query = {}) => http(`/offerings/${id}/progress?${scopedParams(query)}`),
  ownProgress: (query) => http(`/me/progress?${pageParams(query)}`),
}
