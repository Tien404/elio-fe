import { ServiceError } from '@/services/errors'
import type {
  AssessmentService,
  AssignmentView,
  AssignmentQuery,
  Submission,
  SubmissionView,
} from '@/services/assessment-contracts'
import type { Assignment, FileAsset, SubmissionReceipt, Offering } from '@/services/contracts'
import type { OfferingView } from '@/services/course-contracts'
import { allPages, apiCourses, localPage, matches, offeringView } from './courses'
import { currentIdentity, http, json, unsupported } from './http'

type AssignmentDto = Assignment & {
  topicId: number | null
  mandatory: boolean
  attachments: FileAsset[]
  serverNow: string
}
async function ownSubmission(id: number): Promise<Submission | null> {
  try {
    return await http(`/assignments/${id}/submissions/me`)
  } catch (error) {
    if (
      error instanceof ServiceError &&
      error.status === 404 &&
      error.fields.code === 'NOT_SUBMITTED'
    )
      return null
    throw error
  }
}
async function assignmentView(dto: AssignmentDto, section?: OfferingView): Promise<AssignmentView> {
  const offering = section ?? (await apiCourses.get(dto.offeringId))
  const teacher = offering.teachingRole !== null
  const now = Date.parse(dto.serverNow)
  const [topics, submission] = await Promise.all([
    allPages<AssignmentView['topics'][number]>(`/offerings/${dto.offeringId}/topics`),
    teacher ? Promise.resolve(null) : ownSubmission(dto.id),
  ])
  return {
    assignment: dto,
    topicId: dto.topicId,
    attachments: dto.attachments,
    mandatory: dto.mandatory,
    teacher,
    writable: offering.permissions.teach && dto.status !== 'ARCHIVED',
    canSubmit:
      !teacher &&
      offering.offering.status === 'OPEN' &&
      dto.status === 'PUBLISHED' &&
      now >= Date.parse(dto.openAt) &&
      now <= Date.parse(dto.cutoffAt),
    canGrade: false,
    serverNow: dto.serverNow,
    offeringLabel: `${offering.offering.courseCode} · ${offering.offering.sectionCode}`,
    topics,
    submission,
    group: null,
    ownGrade: null,
  }
}
export const apiAssessment: AssessmentService = {
  async list(query: AssignmentQuery = {}) {
    const sections = query.offeringId
      ? [await apiCourses.get(query.offeringId)]
      : (await allPages<Offering & Omit<OfferingView, 'offering'>>('/offerings')).map(offeringView)
    const lists = await Promise.all(
      sections
        .filter((s) => s.permissions.academic)
        .map(async (section) => {
          const rows = await allPages<AssignmentDto>(
            `/offerings/${section.offering.id}/assignments`,
          )
          return Promise.all(
            rows
              .filter(
                (a) =>
                  matches(query.search, a.title) &&
                  (!query.status || a.status === query.status) &&
                  (!query.mode || a.mode === query.mode),
              )
              .map((a) => assignmentView(a, section)),
          )
        }),
    )
    return localPage(
      lists.flat().sort((a, b) => Date.parse(a.assignment.dueAt) - Date.parse(b.assignment.dueAt)),
      query,
    )
  },
  get: async (id) => assignmentView(await http<AssignmentDto>(`/assignments/${id}`)),
  async save(offeringId, id, input, version) {
    if (input.mode !== 'INDIVIDUAL') return unsupported()
    return assignmentView(
      await http<AssignmentDto>(
        id ? `/assignments/${id}` : `/offerings/${offeringId}/assignments`,
        json(id ? 'PATCH' : 'POST', input, version),
      ),
    )
  },
  async stream(id, subjectId) {
    const view = await apiAssessment.get(id)
    let submission = view.submission
    if (view.teacher) {
      const rows = await allPages<Submission>(`/assignments/${id}/submissions`)
      submission = rows.find((s) => s.subjectId === subjectId) ?? null
    }
    if (!submission)
      return {
        submission: null,
        history: [],
        files: [],
        recipients: [],
        grade: null,
        revisions: [],
      }
    return http<SubmissionView>(`/submissions/${submission.id}/history`)
  },
  async prepare(id, input, requestKey) {
    if (input.groupId !== null) return unsupported()
    const files = await Promise.all(
      input.fileIds.map((fileId) => http<FileAsset>(`/files/${fileId}`)),
    )
    return {
      actorId: currentIdentity()!.me.account.id,
      assignmentId: id,
      requestKey,
      payloadHash: '',
      input,
      files,
      receipt: null,
    }
  },
  async confirm(id, prepared) {
    const submission = await http<Submission>(
      `/assignments/${id}/submissions`,
      json('POST', {
        expectedVersion: prepared.input.expectedVersion,
        fileIds: prepared.input.fileIds,
      }),
    )
    const version = submission.currentVersion!
    return {
      submissionId: submission.id,
      versionNo: version.versionNo,
      receiptCode: version.receiptCode,
      submittedAt: version.submittedAt,
    } satisfies SubmissionReceipt
  },
  groups: unsupported,
  candidates: unsupported,
  saveGroup: unsupported,
  receipt: unsupported,
  queue: unsupported,
  saveGrade: unsupported,
  publishGrade: unsupported,
  gradebook: unsupported,
  weights: unsupported,
  csv: unsupported,
}

export const getMvpSubmissions = (id: number, page = 1) =>
  http<import('@/services/course-contracts').Page<Submission>>(
    `/assignments/${id}/submissions?page=${page}&pageSize=25`,
  )
export const getMvpSubmissionHistory = (id: number) =>
  http<SubmissionView>(`/submissions/${id}/history`)
