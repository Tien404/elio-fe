import type { OperationalAudit } from '@/services/admin-contracts'
import type { Membership, Offering } from '@/services/contracts'
import type {
  CatalogCourse,
  CourseService,
  OfferingView,
  Page,
  PageQuery,
} from '@/services/course-contracts'
import { currentIdentity, http, json } from './http'

type OfferingDto = Offering & Omit<OfferingView, 'offering'>
export function offeringView(dto: OfferingDto): OfferingView {
  const {
    permissions,
    lead,
    teachingRole,
    learningInformation,
    joinCode,
    joinEnabled,
    completedMaterials,
    totalMaterials,
    ...offering
  } = dto
  return {
    offering,
    permissions,
    lead,
    teachingRole,
    learningInformation,
    joinCode,
    joinEnabled,
    completedMaterials,
    totalMaterials,
  }
}
export async function allPages<T>(path: string): Promise<T[]> {
  const rows: T[] = []
  let number = 1
  while (true) {
    const page = await http<Page<T>>(
      `${path}${path.includes('?') ? '&' : '?'}page=${number}&pageSize=100`,
    )
    rows.push(...page.items)
    if (number >= page.totalPages) return rows
    number++
  }
}
export function localPage<T>(rows: T[], query: PageQuery = {}): Page<T> {
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 25
  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    page,
    pageSize,
    totalItems: rows.length,
    totalPages: Math.ceil(rows.length / pageSize),
  }
}
export const matches = (search: string | undefined, ...values: unknown[]) =>
  !search || values.join(' ').toLowerCase().includes(search.toLowerCase())
interface AuditEntryDto {
  id: number
  actorId?: number
  actor?: { id: number }
  action: string
  targetType: string
  targetId: number
  createdAt: string
  reason: string | null
}

export async function operationalAudit(path: string): Promise<Page<OperationalAudit>> {
  const result = await http<Page<AuditEntryDto>>(path)
  return {
    ...result,
    items: result.items.map((entry) => ({
      key: String(entry.id),
      actorId: entry.actorId ?? entry.actor?.id ?? 0,
      action: entry.action,
      targetKind: entry.targetType,
      targetId: entry.targetId,
      occurredAt: entry.createdAt,
      reason: entry.reason,
    })),
  }
}

export const pageParams = (query: PageQuery = {}) =>
  new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 25),
  })

export const apiCourses: CourseService = {
  async catalog(query = {}) {
    const params = pageParams(query)
    if (query.search?.trim()) params.set('q', query.search.trim())
    return http(`/courses?${params}`)
  },
  createCatalog: (input) => http('/admin/courses', json('POST', input)),
  catalogDetail: (id) => http<CatalogCourse>(`/courses/${id}`),
  async list(query = {}) {
    const admin = currentIdentity()?.me.account.role === 'ADMIN'
    const path = admin ? '/admin/offerings' : '/offerings'
    const filters = new URLSearchParams()
    if (admin) {
      if (query.search?.trim()) filters.set('q', query.search.trim())
      if (query.status) filters.set('status', query.status)
      if (query.semester?.trim()) filters.set('semester', query.semester.trim())
      if (!query.sort && !query.courseId) {
        const params = pageParams(query)
        filters.forEach((value, key) => params.set(key, value))
        const result = await http<Page<OfferingDto>>(`${path}?${params}`)
        return {
          ...result,
          items: await Promise.all(result.items.map((item) => apiCourses.get(item.id))),
        }
      }
    }
    let rows = (
      await Promise.all(
        (await allPages<OfferingDto>(filters.size ? `${path}?${filters}` : path)).map((item) =>
          admin ? apiCourses.get(item.id) : Promise.resolve(offeringView(item)),
        ),
      )
    ).filter(
      (v) =>
        (admin ||
          (matches(query.search, v.offering.title, v.offering.courseCode, v.offering.sectionCode) &&
            (!query.semester || v.offering.semester.includes(query.semester)) &&
            (!query.status || v.offering.status === query.status))) &&
        (!query.courseId || v.offering.courseId === query.courseId),
    )
    if (query.sort === 'title-asc' || query.sort === 'title-desc')
      rows = rows.sort(
        (a, b) =>
          a.offering.title.localeCompare(b.offering.title) * (query.sort === 'title-desc' ? -1 : 1),
      )
    if (query.sort === 'newest') rows = rows.sort((a, b) => b.offering.id - a.offering.id)
    if (query.sort === 'semester')
      rows = rows.sort((a, b) => b.offering.semester.localeCompare(a.offering.semester))
    return localPage(rows, query)
  },
  get: async (id) => offeringView(await http<OfferingDto>(`/offerings/${id}`)),
  create: async (input) =>
    offeringView(
      await http<OfferingDto>(
        '/offerings',
        json('POST', {
          courseCode: input.courseCode,
          title: input.title,
          semester: input.semester,
          sectionCode: input.sectionCode,
          learningInformation: input.learningInformation,
        }),
      ),
    ),
  edit: async (id, input, version) =>
    offeringView(await http<OfferingDto>(`/offerings/${id}`, json('PATCH', input, version))),
  transition: async (id, action, reason, version) =>
    offeringView(
      await http<OfferingDto>(
        action === 'restore' ? `/offerings/${id}/restore` : `/offerings/${id}`,
        json(
          action === 'restore' ? 'POST' : 'PATCH',
          action === 'restore'
            ? { reason }
            : action === 'publish'
              ? { status: 'OPEN' }
              : { status: 'ARCHIVED', reason },
          version,
        ),
      ),
    ),
  async join(id, code) {
    const member = await http<Membership>(
      id ? `/offerings/${id}/enrollments` : '/offerings/join',
      json('POST', { code }),
    )
    return apiCourses.get(member.offeringId)
  },
  async members(id, query = {}) {
    const rows = (await allPages<Membership>(`/offerings/${id}/memberships`)).filter(
      (m) =>
        matches(query.search, m.account.displayName, m.account.id) &&
        (!query.status || m.status === query.status),
    )
    return localPage(rows, query)
  },
  async candidates(id, role, query = {}) {
    const endpoint = role === 'STUDENT' ? 'enrollment-candidates' : 'teaching-team/candidates'
    const params = pageParams(query)
    if (query.search?.trim()) params.set('q', query.search.trim())
    return http(`/offerings/${id}/${endpoint}?${params}`)
  },
  enroll: (id, accountId) =>
    http<Membership>(`/offerings/${id}/enrollments`, json('POST', { accountId })),
  joinCode: async (id, action, version) =>
    offeringView(
      await http<OfferingDto>(
        `/offerings/${id}`,
        json('PATCH', { joinCodeAction: action }, version),
      ),
    ),
  team: (id, query) => http(`/offerings/${id}/teaching-team?${pageParams(query)}`),
  async addInstructor(id, accountId, reason) {
    await http(
      `/offerings/${id}/teaching-team`,
      json('POST', { accountId, reason: reason.trim() || null }),
    )
    return apiCourses.get(id)
  },
  async removeInstructor(id, membershipId, reason) {
    await http(
      `/offerings/${id}/memberships/${membershipId}`,
      json('PATCH', { status: 'REMOVED', reason }),
    )
    return apiCourses.get(id)
  },
  async transfer(id, membershipId, reason) {
    await http(`/offerings/${id}/lead-transfer`, json('POST', { membershipId, reason }))
    return apiCourses.get(id)
  },
  audit: (id, query) => operationalAudit(`/offerings/${id}/audit-entries?${pageParams(query)}`),
}
