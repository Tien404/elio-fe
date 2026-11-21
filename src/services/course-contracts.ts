import type { OperationalAudit } from '@/services/admin-contracts'
import type {
  AccountSummary,
  FileAsset,
  Membership,
  Offering,
  Resource,
} from '@/services/contracts'

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}
export interface PageQuery {
  page?: number
  pageSize?: number
  search?: string
}
export interface CatalogCourse {
  id: number
  courseCode: string
  courseName: string
  credits: number
}
export interface CreateCatalogCourseInput {
  facultyCode: string
  yearLevel: number
  degreeLevel: 'UNDERGRADUATE' | 'MASTERS' | 'PHD'
  courseName: string
  credits: number
  description?: string
}
export interface OfferingQuery extends PageQuery {
  sort?: 'newest' | 'title-asc' | 'title-desc' | 'semester'
  semester?: string
  status?: Offering['status'] | ''
  courseId?: number
}
export interface OfferingPermissions {
  academic: boolean
  teach: boolean
  edit: boolean
  publish: boolean
  archive: boolean
  restore: boolean
  manageTeam: boolean
  repairLead: boolean
  enroll: boolean
  manageCode: boolean
}
export interface OfferingView {
  offering: Offering
  permissions: OfferingPermissions
  lead: AccountSummary | null
  teachingRole: Membership['teachingRole']
  learningInformation: string | null
  joinCode: string | null
  joinEnabled: boolean
  completedMaterials: number
  totalMaterials: number
}
export interface CreateOfferingInput {
  courseCode: string
  title: string
  semester: string
  sectionCode: string
  courseName?: string
  credits?: number
  learningInformation: string
}
export interface EditOfferingInput {
  title: string
  semester: string
  sectionCode: string
  learningInformation: string
}
export interface Topic {
  id: number
  offeringId: number
  title: string
  position: number
  version: number
}
export interface TopicInput {
  title: string
  position: number
}
export interface MaterialInput {
  title: string
  topicId: number
  kind: Resource['kind']
  body: string | null
  externalUrl: string | null
  fileIds: number[]
  status: Resource['status']
  mandatory: boolean
}
export interface MaterialView {
  resource: Resource & { topicId: number }
  mandatory: boolean
  completed: boolean
  files: FileAsset[]
}
export interface AnnouncementInput {
  title: string
  body: string
}
export interface AnnouncementView extends AnnouncementInput {
  id: number
  offeringId: number
  version: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  publishedAt: string | null
  hasUnpublishedChanges: boolean
}
export interface TeamAudit {
  entry: {
    id: number
    offeringId: number | null
    actorKind: 'HUMAN' | 'SYSTEM'
    action: string
    targetKind: string
    targetId: number | null
    occurredAt: string
  }
  actor: AccountSummary
  reason: string
}
export interface CourseService {
  catalog(query?: PageQuery): Promise<Page<CatalogCourse>>
  createCatalog(input: CreateCatalogCourseInput): Promise<CatalogCourse>
  catalogDetail(id: number): Promise<CatalogCourse>
  list(query?: OfferingQuery): Promise<Page<OfferingView>>
  get(id: number): Promise<OfferingView>
  create(input: CreateOfferingInput): Promise<OfferingView>
  edit(id: number, input: EditOfferingInput, expectedVersion: number): Promise<OfferingView>
  transition(
    id: number,
    action: 'publish' | 'archive' | 'restore',
    reason: string,
    expectedVersion: number,
  ): Promise<OfferingView>
  join(id: number, code: string): Promise<OfferingView>
  members(
    id: number,
    query?: PageQuery & { status?: Membership['status'] | '' },
  ): Promise<Page<Membership>>
  candidates(
    id: number,
    role: 'STUDENT' | 'INSTRUCTOR',
    query?: PageQuery,
  ): Promise<Page<AccountSummary>>
  enroll(id: number, accountId: number): Promise<Membership>
  joinCode(id: number, action: 'rotate' | 'disable', expectedVersion: number): Promise<OfferingView>
  team(id: number, query?: PageQuery): Promise<Page<Membership>>
  addInstructor(id: number, accountId: number, reason: string): Promise<OfferingView>
  removeInstructor(id: number, membershipId: number, reason: string): Promise<OfferingView>
  transfer(id: number, membershipId: number, reason: string): Promise<OfferingView>
  audit(id: number, query?: PageQuery): Promise<Page<OperationalAudit>>
}
export interface ContentService {
  topics(id: number, query?: PageQuery): Promise<Page<Topic>>
  createTopic(id: number, input: TopicInput): Promise<Topic>
  updateTopic(id: number, input: TopicInput, expectedVersion: number): Promise<Topic>
  materials(
    id: number,
    query?: PageQuery & { topicId?: number; status?: Resource['status'] | '' },
  ): Promise<Page<MaterialView>>
  material(id: number): Promise<MaterialView>
  saveMaterial(
    offeringId: number,
    id: number | null,
    input: MaterialInput,
    expectedVersion?: number,
  ): Promise<MaterialView>
  completeMaterial(id: number): Promise<MaterialView>
  uncompleteMaterial(id: number): Promise<MaterialView>
  announcements(id: number, query?: PageQuery): Promise<Page<AnnouncementView>>
  announcement(id: number): Promise<AnnouncementView>
  publishAnnouncement(id: number, expectedVersion: number): Promise<AnnouncementView>
  saveAnnouncement(
    offeringId: number,
    id: number | null,
    input: AnnouncementInput,
    publish: boolean,
    expectedVersion?: number,
  ): Promise<AnnouncementView>
}
