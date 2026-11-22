import { gradeView, gradeRevision, bookView, type MainGrade, type MainBook } from './grading-dto'
import { ServiceError } from '@/services/errors'
import type {
  AssessmentService,
  AssignmentView,
  AssignmentQuery,
  AssignmentInput,
  GroupView,
  GradeSubject,
  ResultQuery,
  SubmissionVersion,
  Submission,
  SubmissionView,
} from '@/services/assessment-contracts'
import type {
  Assignment,
  FileAsset,
  SubmissionReceipt,
  Offering,
  Membership,
} from '@/services/contracts'
import type { OfferingView, PageQuery } from '@/services/course-contracts'
import { allPages, apiCourses, localPage, matches, offeringView, pageParams } from './courses'
import { currentIdentity, http, json } from './http'

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
  const [topics, submission, groups] = await Promise.all([
    allPages<AssignmentView['topics'][number]>(`/offerings/${dto.offeringId}/topics`),
    teacher ? Promise.resolve(null) : ownSubmission(dto.id),
    !teacher && dto.mode === 'GROUP'
      ? apiAssessment.groups(dto.id, { pageSize: 100 })
      : Promise.resolve(null),
  ])
  const group =
    groups?.items.find((g) => g.group.memberStudentIds.includes(currentIdentity()!.me.account.id))
      ?.group ?? null
  return {
    assignment: dto,
    topicId: dto.topicId,
    attachments: dto.attachments,
    mandatory: dto.mandatory,
    teacher,
    writable: offering.permissions.teach && dto.status !== 'ARCHIVED',
    canSubmit:
      !teacher &&
      (dto.mode === 'INDIVIDUAL' || !!group) &&
      offering.offering.status === 'OPEN' &&
      dto.status === 'PUBLISHED' &&
      now >= Date.parse(dto.openAt) &&
      now <= Date.parse(dto.cutoffAt),
    serverNow: dto.serverNow,
    offeringLabel: `${offering.offering.courseCode} · ${offering.offering.sectionCode}`,
    topics,
    submission,
    group,
    ownGrade: null,
  }
}
function assignmentBody(input: AssignmentInput) {
  const {
    title,
    instructions,
    mode,
    status,
    openAt,
    dueAt,
    cutoffAt,
    maxScore,
    weight,
    topicId,
    fileIds,
    mandatory,
  } = input
  return {
    maxGroupSize: mode === 'GROUP' ? (input.maxGroupSize ?? 4) : null,
    groupFormation: input.groupFormation ?? 'SELF',
    title,
    instructions,
    mode,
    status,
    openAt,
    dueAt,
    cutoffAt,
    maxScore,
    weight,
    topicId,
    fileIds,
    mandatory,
  }
}

function receiptView(version: SubmissionVersion): SubmissionReceipt {
  const { submissionId, versionNo, receiptCode, submittedAt } = version
  return { submissionId, versionNo, receiptCode, submittedAt }
}

function gradebookFilters(query: ResultQuery) {
  const filters = new URLSearchParams()
  if (query.search) filters.set('search', query.search)
  if (query.state) filters.set('state', query.state)
  if (query.activityId) filters.set('activityId', String(query.activityId))
  return filters
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
    return assignmentView(
      await http<AssignmentDto>(
        id ? `/assignments/${id}` : `/offerings/${offeringId}/assignments`,
        json(id ? 'PATCH' : 'POST', assignmentBody(input), version),
      ),
    )
  },
  async stream(id, subjectId, submissionId) {
    if (submissionId) return submissionHistory(submissionId)
    const submission =
      currentIdentity()?.me.account.role === 'STUDENT'
        ? await ownSubmission(id)
        : subjectId === undefined
          ? null
          : ((await apiAssessment.queue(id, { pageSize: 100 })).items.find(
              (s) => s.subjectId === subjectId,
            )?.submission ?? null)
    if (!submission)
      return {
        submission: null,
        history: [],
        files: [],
        recipients: [],
        grade: null,
        revisions: [],
      }
    return submissionHistory(submission.id)
  },
  async prepare(id, input, requestKey) {
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
    if (prepared.actorId !== currentIdentity()?.me.account.id || prepared.assignmentId !== id)
      throw new ServiceError(403, 'This confirmation belongs to another account or assignment.')
    const submission = await http<Submission>(`/assignments/${id}/submissions`, {
      ...json('POST', prepared.input),
      headers: { 'Idempotency-Key': prepared.requestKey },
    })
    return receiptView(submission.currentVersion!)
  },
  joinGroup: async (id) => {
    await http(`/groups/${id}/membership`, { method: 'POST' })
  },
  leaveGroup: async (id) => {
    await http(`/groups/${id}/membership`, { method: 'DELETE' })
  },
  releaseGrades: async (id) => {
    await http(`/assignments/${id}/grade-release`, { method: 'PUT' })
  },
  async groups(id, query = {}) {
    const dto = await http<{ myGroupId: number | null; items: MainGroup[] }>(
      `/assignments/${id}/groups`,
    )
    return localPage(dto.items.map(groupView), query)
  },
  async candidates(id, groupId) {
    const { offeringId } = await http<AssignmentDto>(`/assignments/${id}`)
    const [roster, groups] = await Promise.all([
      allPages<Membership>(`/offerings/${offeringId}/memberships`),
      apiAssessment.groups(id, { pageSize: 100 }).then((p) => p.items),
    ])
    const assignedElsewhere = new Set(
      groups
        .filter(({ group }) => group.id !== groupId)
        .flatMap(({ group }) => group.memberStudentIds),
    )
    return roster
      .filter(
        (m) =>
          m.role === 'STUDENT' &&
          m.status === 'ACTIVE' &&
          m.account.status === 'ACTIVE' &&
          !assignedElsewhere.has(m.account.id),
      )
      .map((m) => m.account)
  },
  async saveGroup(id, groupId, input) {
    return groupView(
      await http<MainGroup>(
        groupId ? `/groups/${groupId}` : `/assignments/${id}/groups`,
        json(groupId ? 'PATCH' : 'POST', {
          name: input.name,
          ...(currentIdentity()?.me.account.role === 'INSTRUCTOR'
            ? { memberIds: input.memberStudentIds }
            : {}),
        }),
      ),
    )
  },
  async receipt(id, key) {
    try {
      return receiptView(
        await http<SubmissionVersion>(
          `/assignments/${id}/submission-receipts/${encodeURIComponent(key)}`,
        ),
      )
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.status === 404 &&
        error.fields.code === 'NOT_FOUND'
      )
        return null
      throw error
    }
  },
  async queue(id, query = {}) {
    const dto = await http<{
      subjects: (Omit<GradeSubject, 'grade'> & { grade: MainGrade | null })[]
      canGrade: boolean
      serverNow: string
      subjectType: 'STUDENT' | 'GROUP'
    }>(`/assignments/${id}/grade-records`)
    return {
      ...localPage(
        dto.subjects.map((s) => ({ ...s, grade: s.grade ? gradeView(s.grade) : null })),
        query,
      ),
      canGrade: dto.canGrade,
      serverNow: dto.serverNow,
      subjectType: dto.subjectType,
    }
  },
  async saveGrade(id, input) {
    const { subjectId, submissionId, gradeRecordId, expectedGradeVersion, ...body } = input
    if (gradeRecordId !== null) {
      return gradeView(
        await http<MainGrade>(
          `/grade-records/${gradeRecordId}/revisions`,
          json(
            'POST',
            { ...body, score: body.specialMark ? null : body.score },
            expectedGradeVersion,
          ),
        ),
      )
    }
    if (body.sourceVersionNo === null) {
      return gradeView(
        await http<MainGrade>(
          `/assignments/${id}/missing-work-decisions`,
          json('POST', {
            studentId:
              (await http<AssignmentDto>(`/assignments/${id}`)).mode === 'GROUP'
                ? (await http<MainGroup>(`/groups/${subjectId}`)).members[0]?.id
                : subjectId,
            specialMark: body.specialMark ?? null,
            zeroReason: body.zeroReason,
            feedback: body.feedback,
          }),
        ),
      )
    }
    return gradeView(
      await http<MainGrade>(
        `/submissions/${submissionId}/grade-record`,
        json('POST', { ...body, score: body.specialMark ? null : body.score }),
      ),
    )
  },
  publishGrade: async (_id, gradeId, revisionNo, version) =>
    gradeView(
      await http<MainGrade>(
        `/grade-records/${gradeId}/publication`,
        json('PUT', { revisionNo }, version),
      ),
    ),
  async gradebook(offeringId, query = {}) {
    const params = pageParams(query)
    gradebookFilters(query).forEach((value, key) => params.set(key, value))
    return bookView(await http<MainBook>(`/offerings/${offeringId}/gradebook?${params}`), query)
  },
  weights: (offeringId, values, version) =>
    http(`/offerings/${offeringId}/gradebook/weights`, json('PUT', { values }, version)),
  csv(offeringId, query = {}) {
    const params = gradebookFilters(query)
    return http<Blob>(`/offerings/${offeringId}/gradebook.csv${params.size ? `?${params}` : ''}`, {
      headers: { Accept: 'text/csv' },
    })
  },
}

export async function getPublishedAssignmentResults(
  offeringId: number | undefined,
  query: PageQuery,
) {
  const reports = await http<{
    items: {
      offeringId: number
      items: {
        type: string
        gradeId: number | null
        title: string
        rangeMax: number
        activityId: number
        grade: number | null
      }[]
    }[]
  }>('/me/grades')
  const rows = reports.items
    .filter((r) => !offeringId || r.offeringId === offeringId)
    .flatMap((r) =>
      r.items
        .filter((i) => i.type === 'ASSIGNMENT' && i.gradeId !== null && i.grade !== null)
        .map((i) => ({ ...i, offeringId: r.offeringId })),
    )
  const page = localPage(rows, query)
  return {
    ...page,
    items: await Promise.all(
      page.items.map(async (i) => {
        const grade = await http<MainGrade>(`/grade-records/${i.gradeId}`)
        return {
          assignmentId: i.activityId,
          offeringId: i.offeringId,
          groupId: grade.groupId,
          title: i.title,
          maxScore: i.rangeMax,
          publishedAt: grade.publishedAt!,
          revision: gradeRevision(grade.id, grade.publishedRevision!),
        }
      }),
    ),
  }
}

export const getMvpSubmissions = (id: number, page = 1) =>
  http<import('@/services/course-contracts').Page<Submission>>(
    `/assignments/${id}/submissions?page=${page}&pageSize=25`,
  )
export const getMvpSubmissionHistory = submissionHistory

async function submissionHistory(id: number): Promise<SubmissionView> {
  const view = await http<
    Omit<SubmissionView, 'grade' | 'revisions'> & { grade: MainGrade | null }
  >(`/submissions/${id}/history`)
  return {
    ...view,
    grade: view.grade ? gradeView(view.grade) : null,
    revisions: (view.grade?.revisions ?? []).map((r) => gradeRevision(view.grade!.id, r)),
  }
}

interface MainGroup {
  id: number
  assignmentId: number
  name: string
  members: { id: number; displayName: string; status?: 'ACTIVE' | 'LOCKED' }[]
  locked: boolean
  lockedAt: string | null
  version: number
}
function groupView(row: MainGroup): GroupView {
  return {
    group: {
      id: row.id,
      assignmentId: row.assignmentId,
      name: row.name,
      memberStudentIds: row.members.map((m) => m.id),
      lockedAt: row.lockedAt,
      version: row.version,
    },
    members: row.members.map((m) => ({
      id: m.id,
      displayName: m.displayName,
      status: m.status ?? 'ACTIVE',
      role: 'STUDENT',
      mustChangePassword: false,
    })),
  }
}
