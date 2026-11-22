import type { FileAsset, FileService, Resource } from '@/services/contracts'
import type {
  ContentService,
  MaterialView,
  Topic,
  AnnouncementView,
} from '@/services/course-contracts'
import { allPages, localPage, matches } from './courses'
import { http, json, unsupported } from './http'

type MaterialDto = Resource & {
  topicId: number
  mandatory: boolean
  completed: boolean
  files: FileAsset[]
}
function materialView({ mandatory, completed, files, ...resource }: MaterialDto): MaterialView {
  return { mandatory, completed, files, resource }
}
export const apiFiles: FileService = {
  async stage(file, offeringId, purpose, assignmentId) {
    const form = new FormData()
    form.append('file', file)
    const params = new URLSearchParams({ offeringId: String(offeringId), purpose })
    if (assignmentId !== undefined) params.set('assignmentId', String(assignmentId))
    return http(`/files?${params}`, { method: 'POST', body: form })
  },
  download: (id) =>
    http<Blob>(`/files/${id}/content`, { headers: { Accept: 'application/octet-stream' } }),
  reselect: unsupported,
}
export const apiContent: ContentService = {
  topics: (id, query = {}) =>
    http(`/offerings/${id}/topics?page=${query.page ?? 1}&pageSize=${query.pageSize ?? 25}`),
  createTopic: (id, input) => http<Topic>(`/offerings/${id}/topics`, json('POST', input)),
  updateTopic: (id, input, version) => http<Topic>(`/topics/${id}`, json('PATCH', input, version)),
  async materials(id, query = {}) {
    const rows = (await allPages<MaterialDto>(`/offerings/${id}/resources`)).filter(
      (m) =>
        matches(query.search, m.title, m.body) &&
        (!query.topicId || m.topicId === query.topicId) &&
        (!query.status || m.status === query.status),
    )
    return localPage(rows.map(materialView), query)
  },
  material: async (id) => materialView(await http<MaterialDto>(`/resources/${id}`)),
  saveMaterial: async (offeringId, id, input, version) =>
    materialView(
      await http<MaterialDto>(
        id ? `/resources/${id}` : `/offerings/${offeringId}/resources`,
        json(
          id ? 'PATCH' : 'POST',
          {
            title: input.title,
            topicId: input.topicId,
            kind: input.kind,
            body: input.body,
            externalUrl: input.externalUrl,
            fileIds: input.fileIds,
            status: input.status,
            mandatory: input.mandatory,
          },
          version,
        ),
      ),
    ),
  completeMaterial: async (id) =>
    materialView(await http<MaterialDto>(`/resources/${id}/completion`, { method: 'PUT' })),
  async uncompleteMaterial(id) {
    await http(`/resources/${id}/completion`, { method: 'DELETE' })
    return apiContent.material(id)
  },
  async announcements(id, query = {}) {
    const rows = await allPages<MainAnnouncement>(`/offerings/${id}/announcements`)
    return localPage(
      rows.filter((r) => matches(query.search, r.title)).map(announcementView),
      query,
    )
  },
  announcement: async (id) =>
    announcementView(await http<MainAnnouncement>(`/announcements/${id}`)),
  publishAnnouncement: async () => {
    throw new Error('Announcements are published when posted.')
  },
  async saveAnnouncement(offeringId, id, input) {
    if (id !== null) throw new Error('Posted announcements cannot be edited.')
    return announcementView(
      await http<MainAnnouncement>(`/offerings/${offeringId}/announcements`, json('POST', input)),
    )
  },
}
interface MainAnnouncement {
  id: number
  offeringId: number
  title: string
  body: string
  author: { id: number }
  publishedAt: string
}
function announcementView(row: MainAnnouncement): AnnouncementView {
  return {
    id: row.id,
    offeringId: row.offeringId,
    title: row.title,
    body: row.body,
    status: 'PUBLISHED',
    publishedAt: row.publishedAt,
    version: 1,
    hasUnpublishedChanges: false,
  }
}
