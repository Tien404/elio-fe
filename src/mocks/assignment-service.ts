import type { Assignment, Group } from '@/services/contracts'
import type { AssignmentInput, AssignmentView, GroupView } from '@/services/assessment-contracts'
import { ServiceError } from '@/services/errors'
import {
  requireAcademic,
  account,
  nextId,
  text,
  version,
  page,
  matches,
  notify,
  audit,
} from './policy'
import { commit, getStore, now, transientFiles } from './store'
import { request } from './scenarios'
export function assignmentAccess(id: number, write = false) {
  const a = getStore().assignments.find((a) => a.id === id)
  if (!a) throw new ServiceError(404, 'Assignment not found.')
  const access = requireAcademic(a.offeringId, write)
  if (!access.teacher && a.status !== 'PUBLISHED')
    throw new ServiceError(404, 'Assignment is not published.')
  return { ...access, a }
}
export function meta(a: Assignment) {
  return (
    getStore().assessment.meta[a.id] ?? {
      topicId: null,
      fileIds: [],
      mandatory: true,
      everPublished: a.status !== 'DRAFT',
    }
  )
}
export function groupFor(a: Assignment, studentId: number): Group | null {
  return (
    getStore().groups.find(
      (g) => g.assignmentId === a.id && g.memberStudentIds.includes(studentId),
    ) ?? null
  )
}
export function streamFor(a: Assignment, subjectId: number) {
  return (
    getStore().submissions.find(
      (s) =>
        s.assignmentId === a.id &&
        s.subjectId === subjectId &&
        s.subjectType === (a.mode === 'GROUP' ? 'GROUP' : 'STUDENT'),
    ) ?? null
  )
}
export function assignmentView(a: Assignment): AssignmentView {
  const { teacher, offering, me, permissions } = requireAcademic(a.offeringId),
    s = getStore(),
    m = meta(a)
  const group = !teacher && a.mode === 'GROUP' ? groupFor(a, me.account.id) : null
  const submission = teacher
    ? null
    : streamFor(a, a.mode === 'GROUP' ? (group?.id ?? 0) : me.account.id)
  const grade = s.grades.find((g) => g.submissionId === submission?.id)
  return {
    assignment: a,
    topicId: m.topicId,
    attachments: s.files.filter((f) => m.fileIds.includes(f.id)),
    mandatory: m.mandatory,
    teacher,
    writable: permissions.teach && a.status !== 'ARCHIVED',
    canSubmit:
      !teacher &&
      offering.status === 'OPEN' &&
      a.status === 'PUBLISHED' &&
      now() >= Date.parse(a.openAt) &&
      now() <= Date.parse(a.cutoffAt) &&
      (a.mode === 'INDIVIDUAL' || !!group) &&
      !grade,
    canGrade:
      teacher &&
      offering.status === 'OPEN' &&
      a.status === 'PUBLISHED' &&
      now() > Date.parse(a.cutoffAt),
    serverNow: new Date(now()).toISOString(),
    offeringLabel: `${offering.courseCode} · ${offering.sectionCode} · ${offering.semester}`,
    topics: s.workspace.topics.filter((t) => t.offeringId === a.offeringId),
    submission,
    group,
    ownGrade: teacher ? null : (grade?.publishedRevision ?? null),
  }
}
export function validateAssets(
  ids: number[],
  offeringId: number,
  purpose: 'SUBMISSION' | 'ASSIGNMENT_ATTACHMENT',
  actorId: number,
  existing: number[] = [],
) {
  if (
    ids.length > 5 ||
    new Set(ids).size !== ids.length ||
    (purpose === 'SUBMISSION' && !ids.length)
  )
    throw new ServiceError(422, 'Choose 1–5 submission files or up to 5 assignment attachments.')
  return ids.map((id) => {
    const s = getStore(),
      f = s.files.find((f) => f.id === id)
    if (
      !f ||
      f.offeringId !== offeringId ||
      f.purpose !== purpose ||
      f.byteSize < 1 ||
      f.byteSize > 20_000_000
    )
      throw new ServiceError(422, 'Files must match this section and purpose, each at most 20MB.')
    if (existing.includes(id) && f.state !== 'ATTACHED')
      throw new ServiceError(409, 'A previously attached file is no longer available.')
    if (!existing.includes(id)) {
      if (
        f.state !== 'STAGING' ||
        s.stagingOwners[id] !== actorId ||
        Date.parse(f.leaseExpiresAt) <= now()
      )
        throw new ServiceError(
          409,
          'A staged file is unavailable or belongs to another uploader. Review files before confirming.',
        )
      if (!transientFiles.has(id))
        throw new ServiceError(
          409,
          'Demo file bytes are unavailable after reload. Reselect the original file to restore this staged asset.',
        )
    }
    return f
  })
}
function validate(input: AssignmentInput, offeringId: number) {
  text(input.title, 'Title', 200)
  if ((input.instructions?.length ?? 0) > 50_000)
    throw new ServiceError(422, 'Instructions must be at most 50,000 characters.')
  if (
    !['INDIVIDUAL', 'GROUP'].includes(input.mode) ||
    !['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(input.status)
  )
    throw new ServiceError(422, 'Choose a valid mode and status.')
  const times = [input.openAt, input.dueAt, input.cutoffAt].map(Date.parse)
  if (times.some((t) => !Number.isFinite(t)) || times[0] > times[1] || times[1] > times[2])
    throw new ServiceError(422, 'Open time ≤ deadline ≤ submission lock time is required.')
  if (
    !Number.isFinite(input.maxScore) ||
    input.maxScore <= 0 ||
    !Number.isFinite(input.weight) ||
    input.weight < 0 ||
    input.weight > 100
  )
    throw new ServiceError(422, 'Maximum score must be positive; weight must be between 0 and 100.')
  if (
    input.topicId !== null &&
    !getStore().workspace.topics.some((t) => t.id === input.topicId && t.offeringId === offeringId)
  )
    throw new ServiceError(422, 'Choose a topic in this course section.')
}
export const assignmentMethods = {
  list: (query: import('@/services/assessment-contracts').AssignmentQuery = {}) =>
    request((preset) => {
      const { me } = requireListActor(),
        s = getStore()
      if (query.offeringId) requireAcademic(query.offeringId)
      const ids = s.memberships
        .filter((m) => m.account.id === me.account.id && m.status === 'ACTIVE')
        .map((m) => m.offeringId)
      const rows = s.assignments
        .filter(
          (a) =>
            ids.includes(a.offeringId) &&
            (!query.offeringId || a.offeringId === query.offeringId) &&
            (me.account.role === 'INSTRUCTOR' ||
              (a.status === 'PUBLISHED' &&
                s.offerings.find((o) => o.id === a.offeringId)?.status !== 'DRAFT')) &&
            (!query.status || a.status === query.status) &&
            (!query.mode || a.mode === query.mode) &&
            matches(query.search, a.title),
        )
        .sort((a, b) => a.id - b.id)
      const result = page(rows, query, preset === 'empty')
      return { ...result, items: result.items.map(assignmentView) }
    }),
  get: (id: number) => request(() => assignmentView(assignmentAccess(id).a)),
  save: (offeringId: number, id: number | null, input: AssignmentInput, expectedVersion?: number) =>
    request(() =>
      commit(() => {
        const { store: s, me } = requireAcademic(offeringId, true),
          a = id ? assignmentAccess(id, true).a : null
        if (a && a.offeringId !== offeringId)
          throw new ServiceError(404, 'Assignment not found in this section.')
        if (a) version(a.version, expectedVersion)
        validate(input, offeringId)
        const old = a ? meta(a) : null
        if (a?.status === 'ARCHIVED')
          throw new ServiceError(409, 'Archived assignments are read-only.')
        if (old?.everPublished && a) {
          if (input.mode !== a.mode)
            throw new ServiceError(409, 'Assignment mode is immutable after publication.')
          const hasGrade = s.grades.some((g) =>
            s.submissions.some((sub) => sub.assignmentId === a.id && sub.id === g.submissionId),
          )
          const changedTimes = input.dueAt !== a.dueAt || input.cutoffAt !== a.cutoffAt
          if (
            input.openAt !== a.openAt ||
            input.maxScore !== a.maxScore ||
            input.title !== a.title ||
            input.instructions !== a.instructions ||
            input.topicId !== old.topicId ||
            input.mandatory !== old.mandatory ||
            JSON.stringify(input.fileIds) !== JSON.stringify(old.fileIds) ||
            input.weight !== a.weight
          )
            throw new ServiceError(
              409,
              'After publication, only deadline extensions and archive are available. Configure weights from the gradebook.',
            )
          if (
            input.status === 'DRAFT' ||
            (changedTimes &&
              (hasGrade ||
                Date.parse(input.dueAt) < Date.parse(a.dueAt) ||
                Date.parse(input.cutoffAt) < Date.parse(a.cutoffAt)))
          )
            throw new ServiceError(
              409,
              'Deadlines can only be extended before any grade or missing-zero has been saved.',
            )
        }
        if (a && a.mode !== input.mode && s.groups.some((g) => g.assignmentId === a.id))
          throw new ServiceError(
            409,
            'This draft already has groups. Keep Group mode or create a new assignment draft.',
          )
        const files = validateAssets(
          input.fileIds,
          offeringId,
          'ASSIGNMENT_ATTACHMENT',
          me.account.id,
          old?.fileIds,
        )
        const row: Assignment = {
          id: a?.id ?? nextId(s.assignments),
          offeringId,
          title: input.title.trim(),
          instructions: input.instructions,
          mode: input.mode,
          status: input.status,
          openAt: new Date(input.openAt).toISOString(),
          dueAt: new Date(input.dueAt).toISOString(),
          cutoffAt: new Date(input.cutoffAt).toISOString(),
          maxScore: input.maxScore,
          weight: input.weight,
          version: (a?.version ?? 0) + 1,
        }
        if (a) Object.assign(a, row)
        else s.assignments.push(row)
        s.assessment.meta[row.id] = {
          topicId: input.topicId,
          fileIds: input.fileIds,
          mandatory: input.mandatory,
          everPublished: !!old?.everPublished || input.status === 'PUBLISHED',
        }
        files.forEach((f) => (f.state = 'ATTACHED'))
        s.assessment.weightVersions[offeringId] = (s.assessment.weightVersions[offeringId] ?? 1) + 1
        if (input.status === 'PUBLISHED')
          notify(offeringId, 'An assignment was updated.', `/assignments/${row.id}`)
        audit(
          offeringId,
          'ASSIGNMENT_SAVED',
          row.id,
          'Assignment configuration saved.',
          'ASSIGNMENT',
        )
        return assignmentView(a ?? row)
      }),
    ),
  groups: (id: number, query: import('@/services/course-contracts').PageQuery = {}) =>
    request((p) => {
      const { a, teacher, me, store: s } = assignmentAccess(id)
      if (a.mode !== 'GROUP') throw new ServiceError(422, 'This is an individual assignment.')
      return page(
        s.groups
          .filter(
            (g) => g.assignmentId === id && (teacher || g.memberStudentIds.includes(me.account.id)),
          )
          .sort((a, b) => a.id - b.id)
          .map(groupView),
        query,
        p === 'empty',
      )
    }),
  candidates: (id: number) =>
    request(() => {
      const { a, store: s } = assignmentAccess(id, true)
      return s.memberships
        .filter(
          (m) => m.offeringId === a.offeringId && m.role === 'STUDENT' && m.status === 'ACTIVE',
        )
        .map((m) => account(m.account.id))
        .sort((a, b) => a.id - b.id)
    }),
  saveGroup: (
    id: number,
    groupId: number | null,
    input: Pick<Group, 'name' | 'memberStudentIds'>,
    expectedVersion?: number,
  ) =>
    request(() =>
      commit(() => {
        const { a, store: s } = assignmentAccess(id, true)
        if (a.mode !== 'GROUP' || a.status === 'ARCHIVED')
          throw new ServiceError(409, 'An editable group assignment is required.')
        const g = groupId ? s.groups.find((g) => g.id === groupId && g.assignmentId === id) : null
        if (groupId && !g) throw new ServiceError(404, 'Group not found.')
        if (g) {
          version(g.version, expectedVersion)
          if (g.lockedAt)
            throw new ServiceError(409, 'Recipients were finalized. This group is frozen.')
        }
        const name = text(input.name, 'Group name', 120),
          ids = input.memberStudentIds
        if (!ids.length || new Set(ids).size !== ids.length)
          throw new ServiceError(422, 'Select at least one unique assigned student.')
        for (const studentId of ids) {
          if (
            !s.memberships.some(
              (m) =>
                m.offeringId === a.offeringId &&
                m.account.id === studentId &&
                m.status === 'ACTIVE' &&
                m.role === 'STUDENT',
            ) ||
            account(studentId).role !== 'STUDENT'
          )
            throw new ServiceError(
              422,
              'Every recipient must be an assigned student in this section.',
            )
          if (
            s.groups.some(
              (other) =>
                other.assignmentId === id &&
                other.id !== groupId &&
                other.memberStudentIds.includes(studentId),
            )
          )
            throw new ServiceError(409, 'A student can belong to only one group per assignment.')
        }
        if (
          s.groups.some(
            (other) =>
              other.assignmentId === id &&
              other.id !== groupId &&
              other.name.toLowerCase() === name.toLowerCase(),
          )
        )
          throw new ServiceError(409, 'Group names must be unique within this assignment.')
        const row: Group = {
          id: g?.id ?? nextId(s.groups),
          assignmentId: id,
          name,
          memberStudentIds: [...ids],
          lockedAt: null,
          version: (g?.version ?? 0) + 1,
        }
        if (g) Object.assign(g, row)
        else s.groups.push(row)
        return groupView(g ?? row)
      }),
    ),
}
import { current } from './services'
function requireListActor() {
  const actor = current()
  if (actor.me.account.role === 'ADMIN')
    throw new ServiceError(403, 'Operational access does not include assignments.')
  return actor
}
export function groupView(group: Group): GroupView {
  const stream = streamFor(assignmentAccess(group.assignmentId).a, group.id)
  return {
    group,
    members: group.memberStudentIds.map(account),
    frozenRecipients: group.lockedAt
      ? (stream?.recipientStudentIds ?? group.memberStudentIds).map(account)
      : [],
  }
}
