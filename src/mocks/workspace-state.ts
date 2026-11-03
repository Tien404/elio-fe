import type { Membership, Offering, Resource } from '@/services/contracts'
import type {
  AnnouncementInput,
  CatalogCourse,
  TeamAudit,
  Topic,
} from '@/services/course-contracts'

export interface WorkspaceState {
  schemaVersion: 1
  catalog: CatalogCourse[]
  details: Record<number, { learningInformation: string; joinCode: string; joinEnabled: boolean }>
  usedCodes: string[]
  topics: Topic[]
  materialMeta: Record<number, { mandatory: boolean }>
  completions: { resourceId: number; studentId: number; completedAt: string }[]
  announcements: {
    id: number
    offeringId: number
    draft: AnnouncementInput
    version: number
    dirty: boolean
    published: (AnnouncementInput & { publishedAt: string }) | null
  }[]
  audits: TeamAudit[]
  recipientEvents: {
    id: number
    offeringId: number
    recipientId: number
    title: string
    targetUri: string
    occurredAt: string
  }[]
  attemptGuards: {
    id: number
    offeringId: number
    endAt: string
    finalization: 'PENDING' | 'SUCCEEDED' | 'ERROR'
  }[]
}
export function workspaceState(base: {
  offerings: Offering[]
  materials: Resource[]
  memberships: Membership[]
}): WorkspaceState {
  const catalog = [
    ...new Map(
      base.offerings.map((o) => [
        o.courseId,
        { id: o.courseId, courseCode: o.courseCode, courseName: o.title, credits: 3 },
      ]),
    ).values(),
  ]
  const details = Object.fromEntries(
    base.offerings.map((o) => [
      o.id,
      {
        learningInformation: '',
        joinCode: o.id.toString(36).toUpperCase().padStart(6, '0'),
        joinEnabled: o.status === 'OPEN',
      },
    ]),
  )
  const topics = base.offerings.map((o, i) => ({
    id: i + 1,
    offeringId: o.id,
    title: 'General',
    position: 1,
    version: 1,
  }))
  return {
    schemaVersion: 1,
    catalog,
    details,
    usedCodes: Object.values(details).map((d) => d.joinCode),
    topics,
    materialMeta: Object.fromEntries(base.materials.map((m) => [m.id, { mandatory: true }])),
    completions: [],
    announcements: [],
    audits: [],
    recipientEvents: [],
    attemptGuards: [],
  }
}
