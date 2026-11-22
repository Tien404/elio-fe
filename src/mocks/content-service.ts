import type { AnnouncementView, ContentService, MaterialView } from '@/services/course-contracts'
import { ServiceError } from '@/services/errors'
import { commit, getStore, now, transientFiles } from '@/mocks/store'
import { request } from '@/mocks/scenarios'
import {
  audit,
  matches,
  nextId,
  notify,
  page,
  requireAcademic,
  text,
  version,
} from '@/mocks/policy'

function materialView(id: number): MaterialView {
  const s = getStore(),
    resource = s.materials.find((m) => m.id === id)
  if (!resource) throw new ServiceError(404, 'Material not found.')
  const a = requireAcademic(resource.offeringId)
  if (!a.teacher && resource.status !== 'PUBLISHED')
    throw new ServiceError(404, 'Material is not available.')
  const topicId =
    resource.topicId ?? s.workspace.topics.find((t) => t.offeringId === resource.offeringId)!.id
  return {
    resource: { ...resource, topicId },
    mandatory: s.workspace.materialMeta[id]?.mandatory ?? true,
    completed: s.workspace.completions.some(
      (c) => c.resourceId === id && c.studentId === a.me.account.id,
    ),
    files: s.files.filter((f) => resource.fileIds.includes(f.id)),
  }
}
function reorder(offeringId: number, id: number, position: number) {
  const rows = getStore()
    .workspace.topics.filter((t) => t.offeringId === offeringId)
    .sort((a, b) => a.position - b.position)
  const moved = rows.find((t) => t.id === id)!
  const ordered = rows.filter((t) => t.id !== id)
  ordered.splice(position - 1, 0, moved)
  ordered.forEach((t, i) => {
    if (t.position !== i + 1) {
      t.position = i + 1
      t.version += 1
    }
  })
}
function announcementView(id: number): AnnouncementView {
  const s = getStore(),
    record = s.workspace.announcements.find((a) => a.id === id)
  if (!record) throw new ServiceError(404, 'Announcement not found.')
  const a = requireAcademic(record.offeringId)
  if (!a.teacher && !record.published) throw new ServiceError(404, 'Announcement is not available.')
  const content = a.teacher ? record.draft : record.published!
  return {
    id: record.id,
    offeringId: record.offeringId,
    title: content.title,
    body: content.body,
    version: record.version,
    status: record.published ? 'PUBLISHED' : 'DRAFT',
    publishedAt: record.published?.publishedAt ?? null,
    hasUnpublishedChanges: a.teacher && record.dirty,
  }
}
export const mockContent: ContentService = {
  topics: (id, query = {}) =>
    request((preset) => {
      const a = requireAcademic(id)
      const rows = a.store.workspace.topics
        .filter(
          (t) =>
            t.offeringId === id &&
            (a.teacher ||
              a.store.materials.some(
                (m) =>
                  m.offeringId === id &&
                  m.status === 'PUBLISHED' &&
                  (m.topicId ?? a.store.workspace.topics.find((t) => t.offeringId === id)?.id) ===
                    t.id,
              )),
        )
        .filter((t) => matches(query.search, t.title))
        .sort((a, b) => a.position - b.position)
      return page(rows, query, preset === 'empty')
    }),
  createTopic: (id, input) =>
    request(() =>
      commit(() => {
        const a = requireAcademic(id, true),
          title = text(input.title, 'Topic title', 200),
          rows = a.store.workspace.topics.filter((t) => t.offeringId === id)
        if (
          !Number.isInteger(input.position) ||
          input.position < 1 ||
          input.position > rows.length + 1
        )
          throw new ServiceError(422, `Order must be between 1 and ${rows.length + 1}.`)
        const topic = {
          id: nextId(a.store.workspace.topics),
          offeringId: id,
          title,
          position: rows.length + 1,
          version: 1,
        }
        a.store.workspace.topics.push(topic)
        reorder(id, topic.id, input.position)
        return topic
      }),
    ),
  updateTopic: (id, input, expectedVersion) =>
    request(() =>
      commit(() => {
        const s = getStore(),
          topic = s.workspace.topics.find((t) => t.id === id)
        if (!topic) throw new ServiceError(404, 'Topic not found.')
        requireAcademic(topic.offeringId, true)
        version(topic.version, expectedVersion)
        const title = text(input.title, 'Topic title', 200),
          count = s.workspace.topics.filter((t) => t.offeringId === topic.offeringId).length
        if (!Number.isInteger(input.position) || input.position < 1 || input.position > count)
          throw new ServiceError(422, `Order must be between 1 and ${count}.`)
        topic.title = title
        topic.version += 1
        reorder(topic.offeringId, id, input.position)
        return topic
      }),
    ),
  materials: (id, query = {}) =>
    request((preset) => {
      const a = requireAcademic(id)
      const rows = a.store.materials
        .filter(
          (m) =>
            m.offeringId === id &&
            (a.teacher || m.status === 'PUBLISHED') &&
            (!query.status || m.status === query.status) &&
            (!query.topicId || materialView(m.id).resource.topicId === query.topicId) &&
            matches(query.search, m.title),
        )
        .sort((a, b) => a.id - b.id)
      const result = page(rows, query, preset === 'empty')
      return { ...result, items: result.items.map((m) => materialView(m.id)) }
    }),
  material: (id) => request(() => materialView(id)),
  saveMaterial: (offeringId, id, input, expectedVersion) =>
    request(() =>
      commit(() => {
        const a = requireAcademic(offeringId, true),
          s = a.store,
          existing =
            id === null ? null : s.materials.find((m) => m.id === id && m.offeringId === offeringId)
        if (id !== null && !existing)
          throw new ServiceError(404, 'Material not found in this course section.')
        if (existing) {
          version(existing.version, expectedVersion)
          if (existing.status === 'ARCHIVED')
            throw new ServiceError(403, 'Archived materials are read-only.')
        }
        if (
          !['TEXT', 'LINK', 'FILE'].includes(input.kind) ||
          !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(input.status)
        )
          throw new ServiceError(422, 'Select a valid material type and state.')
        const title = text(input.title, 'Title', 200),
          topic = s.workspace.topics.find(
            (t) => t.id === input.topicId && t.offeringId === offeringId,
          )
        if (!topic) throw new ServiceError(422, 'Select a topic in this course section.')
        let body: string | null = null,
          externalUrl: string | null = null
        const fileIds: number[] = []
        if (input.kind === 'TEXT') body = text(input.body ?? '', 'Text content', 50000)
        if (input.kind === 'LINK') {
          try {
            const url = new URL(input.externalUrl ?? '')
            if (!['https:', 'http:'].includes(url.protocol)) throw new Error()
            externalUrl = url.href
          } catch {
            throw new ServiceError(422, 'Enter a valid HTTP or HTTPS URL.')
          }
        }
        if (input.kind === 'FILE') {
          if (input.fileIds.length !== 1)
            throw new ServiceError(
              422,
              'Attach one uploaded material file, up to 50,000,000 bytes.',
            )
          const asset = s.files.find((f) => f.id === input.fileIds[0])
          if (
            !asset ||
            asset.offeringId !== offeringId ||
            asset.purpose !== 'MATERIAL' ||
            asset.byteSize > 50_000_000 ||
            asset.byteSize < 1
          )
            throw new ServiceError(
              422,
              'The file must be a material asset in this course section, up to 50,000,000 bytes.',
            )
          if (
            asset.state === 'EXPIRED' ||
            (asset.state === 'STAGING' && Date.parse(asset.leaseExpiresAt) <= now())
          )
            throw new ServiceError(409, 'The staged file expired. Select and upload it again.')
          if (
            asset.state === 'STAGING' &&
            (s.stagingOwners[asset.id] !== a.me.account.id || !transientFiles.has(asset.id))
          )
            throw new ServiceError(
              409,
              'Select and upload the file again. Demo bytes are not persisted across reload.',
            )
          if (asset.state === 'ATTACHED' && !existing?.fileIds.includes(asset.id))
            throw new ServiceError(409, 'This file is attached to another resource.')
          fileIds.push(asset.id)
        }
        const resource = {
          id: existing?.id ?? nextId(s.materials),
          offeringId,
          title,
          topicId: topic.id,
          kind: input.kind,
          body,
          externalUrl,
          fileIds,
          status: input.status,
          version: (existing?.version ?? 0) + 1,
        }
        if (existing) Object.assign(existing, resource)
        else s.materials.push(resource)
        s.workspace.materialMeta[resource.id] = { mandatory: input.mandatory }
        for (const fileId of fileIds) s.files.find((f) => f.id === fileId)!.state = 'ATTACHED'
        audit(
          offeringId,
          `MATERIAL_${input.status}`,
          resource.id,
          'Learning material saved.',
          'RESOURCE',
        )
        if (input.status === 'PUBLISHED')
          notify(
            offeringId,
            `Material published: ${title}`,
            `/offerings/${offeringId}/materials/${resource.id}`,
          )
        return materialView(resource.id)
      }),
    ),
  completeMaterial: (id) => setCompletion(id, true),
  uncompleteMaterial: (id) => setCompletion(id, false),
  announcements: (id, query = {}) =>
    request((preset) => {
      const a = requireAcademic(id)
      const rows = a.store.workspace.announcements
        .filter((r) => r.offeringId === id && (a.teacher || r.published))
        .map((r) => announcementView(r.id))
        .filter((r) => matches(query.search, r.title))
        .sort((a, b) => b.id - a.id)
      return page(rows, query, preset === 'empty')
    }),
  announcement: (id) => request(() => announcementView(id)),
  async publishAnnouncement(id, expectedVersion) {
    const item = await mockContent.announcement(id)
    return mockContent.saveAnnouncement(
      item.offeringId,
      id,
      { title: item.title, body: item.body },
      true,
      expectedVersion,
    )
  },
  saveAnnouncement: (offeringId, id, input, publish, expectedVersion) =>
    request(() =>
      commit(() => {
        const a = requireAcademic(offeringId, true),
          s = a.store
        if (publish && a.offering.status !== 'OPEN')
          throw new ServiceError(409, 'Announcements can be published in an open class.')
        let record =
          id === null
            ? undefined
            : s.workspace.announcements.find((r) => r.id === id && r.offeringId === offeringId)
        if (id !== null && !record)
          throw new ServiceError(404, 'Announcement not found in this course section.')
        if (record) version(record.version, expectedVersion)
        const draft = {
          title: text(input.title, 'Title', 200),
          body: text(input.body, 'Content', 10000),
        }
        if (!record) {
          record = {
            id: nextId(s.workspace.announcements),
            offeringId,
            draft,
            version: 1,
            dirty: true,
            published: null,
          }
          s.workspace.announcements.push(record)
        } else {
          record.draft = draft
          record.version += 1
          record.dirty = true
        }
        if (publish) {
          record.published = { ...draft, publishedAt: new Date(now()).toISOString() }
          record.dirty = false
          notify(
            offeringId,
            `Announcement published: ${draft.title}`,
            `/offerings/${offeringId}/announcements`,
          )
        }
        return announcementView(record.id)
      }),
    ),
}

function setCompletion(id: number, completed: boolean) {
  return request(() =>
    commit(() => {
      const item = materialView(id),
        a = requireAcademic(item.resource.offeringId)
      if (
        a.me.account.role !== 'STUDENT' ||
        a.offering.status !== 'OPEN' ||
        item.resource.status !== 'PUBLISHED'
      )
        throw new ServiceError(
          403,
          'Only current students can complete published materials in an open course section.',
        )
      if (
        completed &&
        !a.store.workspace.completions.some(
          (c) => c.resourceId === id && c.studentId === a.me.account.id,
        )
      )
        a.store.workspace.completions.push({
          resourceId: id,
          studentId: a.me.account.id,
          completedAt: new Date(now()).toISOString(),
        })
      if (!completed)
        a.store.workspace.completions = a.store.workspace.completions.filter(
          (c) => c.resourceId !== id || c.studentId !== a.me.account.id,
        )
      return materialView(id)
    }),
  )
}
