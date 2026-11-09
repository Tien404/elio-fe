import type { Membership, Offering } from '@/services/contracts'
import type {
  CatalogCourse,
  CourseService,
  OfferingView,
  Page,
  PageQuery,
} from '@/services/course-contracts'
import { http, json, unsupported } from './http'

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
export const apiCourses: CourseService = {
  async catalog(query = {}) {
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 25),
    })
    if (query.search) params.set('q', query.search)
    return http(`/courses?${params}`)
  },
  catalogDetail: (id) => http<CatalogCourse>(`/courses/${id}`),
  async list(query = {}) {
    let rows = (await allPages<OfferingDto>('/offerings'))
      .map(offeringView)
      .filter(
        (v) =>
          matches(query.search, v.offering.title, v.offering.courseCode, v.offering.sectionCode) &&
          (!query.semester || v.offering.semester.includes(query.semester)) &&
          (!query.status || v.offering.status === query.status) &&
          (!query.courseId || v.offering.courseId === query.courseId),
      )
    if (query.sort === 'title-asc' || query.sort === 'title-desc')
      rows = rows.sort(
        (a, b) =>
          a.offering.title.localeCompare(b.offering.title) * (query.sort === 'title-desc' ? -1 : 1),
      )
    if (query.sort === 'newest') rows = rows.sort((a, b) => b.offering.id - a.offering.id)
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
    if (role !== 'STUDENT') return unsupported()
    const params = new URLSearchParams({
      page: String(query.page ?? 1),
      pageSize: String(query.pageSize ?? 25),
    })
    if (query.search) params.set('q', query.search)
    return http(`/offerings/${id}/enrollment-candidates?${params}`)
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
  async team(id, query = {}) {
    return http(
      `/offerings/${id}/teaching-team?page=${query.page ?? 1}&pageSize=${query.pageSize ?? 25}`,
    )
  },
  addInstructor: unsupported,
  removeInstructor: unsupported,
  transfer: unsupported,
  audit: unsupported,
}
