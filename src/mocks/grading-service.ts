import { quizResultProjection } from '@/mocks/quiz-runtime'
import type {
  GradeInput,
  GradeSubject,
  ResultQuery,
  ResultRow,
  ResultCell,
} from '@/services/assessment-contracts'
import type { GradeRevision } from '@/services/contracts'
import { ServiceError } from '@/services/errors'
import { assignmentAccess, streamFor } from './assignment-service'
import { makeStream } from './submission-service'
import {
  requireAcademic,
  account,
  nextId,
  version,
  requireReason,
  page,
  matches,
  audit,
  notify,
} from './policy'
import { getStore, commit, now } from './store'
import { request } from './scenarios'
function gradeAccess(id: number) {
  const ctx = assignmentAccess(id, true)
  if (
    ctx.offering.status !== 'OPEN' ||
    ctx.a.status !== 'PUBLISHED' ||
    now() <= Date.parse(ctx.a.cutoffAt)
  )
    throw new ServiceError(
      409,
      'Grading requires an Open section, a published assignment and current time strictly after cutoff.',
    )
  return ctx
}
export function subjects(id: number): GradeSubject[] {
  const { a, store: s, teacher } = assignmentAccess(id)
  if (!teacher) throw new ServiceError(403, 'Current teaching access is required.')
  const rows =
    a.mode === 'GROUP'
      ? s.groups
          .filter((g) => g.assignmentId === id)
          .map((g) => ({ id: g.id, label: g.name, ids: g.memberStudentIds }))
      : s.memberships
          .filter(
            (m) => m.offeringId === a.offeringId && m.role === 'STUDENT' && m.status === 'ACTIVE',
          )
          .map((m) => ({
            id: m.account.id,
            label: account(m.account.id).displayName,
            ids: [m.account.id],
          }))
  return rows
    .sort((a, b) => a.id - b.id)
    .map((row) => {
      const submission = streamFor(a, row.id)
      return {
        subjectId: row.id,
        label: row.label,
        recipients: (submission?.recipientStudentIds ?? row.ids).map(account),
        submission,
        grade: s.grades.find((g) => g.submissionId === submission?.id) ?? null,
      }
    })
}
export function resultRows(offeringId: number): ResultRow[] {
  const { store: s } = requireAcademic(offeringId)
  const assignments = s.assignments.filter(
      (a) => a.offeringId === offeringId && s.assessment.meta[a.id]?.everPublished,
    ),
    quizzes = s.quizzes.filter((q) => q.offeringId === offeringId && q.status !== 'DRAFT')
  return s.memberships
    .filter((m) => m.offeringId === offeringId && m.role === 'STUDENT' && m.status === 'ACTIVE')
    .sort((a, b) => a.id - b.id)
    .map((m) => {
      const student = account(m.account.id),
        cells: ResultCell[] = assignments.map((a) => {
          const sub = s.submissions.find(
              (sub) => sub.assignmentId === a.id && sub.recipientStudentIds.includes(student.id),
            ),
            g = s.grades.find((g) => g.submissionId === sub?.id),
            r = g?.publishedRevision
          return {
            activityId: a.id,
            kind: 'ASSIGNMENT',
            title: a.title,
            weight: a.weight,
            maxScore: a.maxScore,
            score: r?.score ?? null,
            contribution: r ? round(((r.score / a.maxScore) * a.weight) / 10) : null,
            state: r
              ? r.isMissingZero
                ? 'Published zero'
                : 'Published'
              : g?.draftRevision
                ? 'Not published'
                : sub?.currentVersion
                  ? 'Awaiting grading'
                  : 'Not submitted',
            feedback: r?.feedback ?? null,
            complete: !!sub?.currentVersion,
            gradeRecordId: g?.id ?? null,
            groupId: sub?.subjectType === 'GROUP' ? sub.subjectId : null,
          }
        })
      for (const q of quizzes) {
        const r = quizResultProjection(q.id, student.id),
          weight = s.assessment.quizWeights[q.id] ?? 0,
          score = r?.state === 'RELEASED' ? r.score : null
        cells.push({
          activityId: q.id,
          kind: 'QUIZ',
          title: q.title,
          weight,
          maxScore: q.maxScore,
          score,
          contribution: score === null ? null : round(((score / q.maxScore) * weight) / 10),
          state:
            r?.state === 'RELEASED'
              ? 'Published'
              : r?.state === 'GRADING_ERROR'
                ? 'Grading error'
                : r?.state === 'AWAITING_PUBLICATION'
                  ? 'Awaiting publication'
                  : 'Not started',
          feedback: r?.state === 'RELEASED' ? r.feedback : null,
          complete: s.quizEngine.attempts.some(
            (attempt) =>
              attempt.quizId === q.id &&
              attempt.studentId === student.id &&
              attempt.finalization === 'SUCCEEDED',
          ),
          gradeRecordId: null,
          groupId: null,
        })
      }
      const totalWeight = round(cells.reduce((v, c) => v + c.weight, 0)),
        availableWeight = round(
          cells.filter((c) => c.score !== null).reduce((v, c) => v + c.weight, 0),
        )
      return {
        studentId: student.id,
        membershipId: m.id,
        displayName: student.displayName,
        accountStatus: student.status,
        cells,
        overall: cells.some((c) => c.score !== null)
          ? round(cells.reduce((v, c) => v + (c.contribution ?? 0), 0))
          : null,
        totalWeight,
        availableWeight,
        final: totalWeight === 100 && cells.every((c) => c.score !== null),
      }
    })
}
const round = (value: number) => Math.round((value + Number.EPSILON) * 10000) / 10000
function filterRows(rows: ResultRow[], query: ResultQuery) {
  return rows.filter(
    (r) =>
      matches(query.search, r.displayName, r.studentId) &&
      (query.state !== 'FINAL' || r.final) &&
      (query.state !== 'PROVISIONAL' || !r.final),
  )
}
function activities(offeringId: number) {
  const s = getStore()
  return [
    ...s.assignments
      .filter((a) => a.offeringId === offeringId && s.assessment.meta[a.id]?.everPublished)
      .map((a) => ({
        activityId: a.id,
        kind: 'ASSIGNMENT' as const,
        title: a.title,
        weight: a.weight,
        maxScore: a.maxScore,
      })),
    ...s.quizzes
      .filter((q) => q.offeringId === offeringId && q.status !== 'DRAFT')
      .map((q) => ({
        activityId: q.id,
        kind: 'QUIZ' as const,
        title: q.title,
        weight: s.assessment.quizWeights[q.id] ?? 0,
        maxScore: q.maxScore,
      })),
  ]
}
export const gradingMethods = {
  queue: (id: number, query: import('@/services/course-contracts').PageQuery = {}) =>
    request((p) => page(subjects(id), query, p === 'empty')),
  saveGrade: (id: number, input: GradeInput) =>
    request(() =>
      commit(() => {
        const { a, store: s, me } = gradeAccess(id),
          subject = subjects(id).find((row) => row.subjectId === input.subjectId)
        if (!subject) throw new ServiceError(404, 'Grade subject not found.')
        let stream = subject.submission,
          g = subject.grade
        version(stream?.version ?? 0, input.expectedSubmissionVersion)
        version(g?.version ?? 0, input.expectedGradeVersion)
        const missing = !stream?.currentVersion
        if (
          !Number.isFinite(input.score) ||
          input.score < 0 ||
          input.score > a.maxScore ||
          (input.feedback?.length ?? 0) > 10000
        )
          throw new ServiceError(
            422,
            'Score must be within the assignment maximum; feedback is at most 10,000 characters.',
          )
        if (input.sourceVersionNo !== (stream?.currentVersion?.versionNo ?? null))
          throw new ServiceError(
            412,
            'The source submission version changed. Review the effective files before grading.',
          )
        if (missing && (input.score !== 0 || !input.zeroReason?.trim()))
          throw new ServiceError(
            422,
            'Non-submission requires score 0 and a reason. It creates no submission receipt or completion.',
          )
        if (missing) requireReason(input.zeroReason!)
        if (g?.publishedRevision) requireReason(input.reason ?? '')
        stream ??= makeStream(a, subject.subjectId)
        if (!g) {
          g = {
            id: nextId(s.grades),
            submissionId: stream.id,
            recipientStudentIds: [...stream.recipientStudentIds],
            draftRevision: null,
            publishedRevision: null,
            version: 0,
          }
          s.grades.push(g)
        }
        const r: GradeRevision = {
          gradeRecordId: g.id,
          revisionNo:
            Math.max(
              0,
              ...s.assessment.revisions
                .filter((r) => r.gradeRecordId === g!.id)
                .map((r) => r.revisionNo),
            ) + 1,
          sourceVersionNo: input.sourceVersionNo,
          score: input.score,
          feedback: input.feedback,
          isMissingZero: missing,
          zeroReason: missing ? input.zeroReason : null,
          reason: input.reason,
          revisedBy: me.account.id,
          createdAt: new Date(now()).toISOString(),
        }
        s.assessment.revisions.push(r)
        g.draftRevision = r
        g.version++
        audit(
          a.offeringId,
          'GRADE_DRAFT_SAVED',
          g.id,
          'Private grade revision saved.',
          'GRADE_RECORD',
        )
        return g
      }),
    ),
  publishGrade: (id: number, gradeId: number, revisionNo: number, expectedVersion: number) =>
    request(() =>
      commit(() => {
        const { a, store: s } = gradeAccess(id),
          g = s.grades.find(
            (g) =>
              g.id === gradeId &&
              s.submissions.some((sub) => sub.id === g.submissionId && sub.assignmentId === id),
          )
        if (!g) throw new ServiceError(404, 'Grade record not found.')
        version(g.version, expectedVersion)
        if (!g.draftRevision || g.draftRevision.revisionNo !== revisionNo)
          throw new ServiceError(412, 'The selected draft changed. Review the latest saved grade.')
        g.publishedRevision = g.draftRevision
        g.version++
        audit(a.offeringId, 'GRADE_PUBLISHED', g.id, 'Grade revision published.', 'GRADE_RECORD')
        notify(
          a.offeringId,
          'An assignment result is available.',
          `/results?offeringId=${a.offeringId}`,
          g.recipientStudentIds,
        )
        return g
      }),
    ),
  gradebook: (offeringId: number, query: ResultQuery = {}) =>
    request((p) => {
      const { teacher, me, permissions } = requireAcademic(offeringId),
        rows = resultRows(offeringId).filter((r) => teacher || r.studentId === me.account.id)
      return {
        rows: page(filterRows(rows, query), query, p === 'empty'),
        activities: activities(offeringId),
        version: getStore().assessment.weightVersions[offeringId] ?? 1,
        writable: permissions.teach,
        teacher,
        serverNow: new Date(now()).toISOString(),
      }
    }),
  weights: (
    offeringId: number,
    values: { id: number; kind: 'ASSIGNMENT' | 'QUIZ'; weight: number }[],
    expectedVersion: number,
  ) =>
    request(() =>
      commit(() => {
        const { store: s } = requireAcademic(offeringId, true)
        version(s.assessment.weightVersions[offeringId] ?? 1, expectedVersion)
        const all = activities(offeringId)
        if (
          values.length !== all.length ||
          new Set(values.map((v) => `${v.kind}:${v.id}`)).size !== all.length ||
          values.some(
            (v) =>
              !all.some((a) => a.activityId === v.id && a.kind === v.kind) ||
              !Number.isFinite(v.weight) ||
              v.weight < 0 ||
              v.weight > 100,
          )
        )
          throw new ServiceError(
            422,
            'Provide a weight between 0 and 100 for every published activity.',
          )
        for (const value of values) {
          if (value.kind === 'QUIZ') s.assessment.quizWeights[value.id] = value.weight
          else {
            const a = s.assignments.find((a) => a.id === value.id)!
            a.weight = value.weight
            a.version++
          }
        }
        s.assessment.weightVersions[offeringId] = (s.assessment.weightVersions[offeringId] ?? 1) + 1
      }),
    ),
  csv: (offeringId: number, query: ResultQuery = {}) =>
    request(() => {
      const { teacher } = requireAcademic(offeringId)
      if (!teacher)
        throw new ServiceError(403, 'Current teaching access is required for gradebook CSV.')
      const all = activities(offeringId).filter(
          (a) => !query.activityId || a.activityId === query.activityId,
        ),
        rows = filterRows(resultRows(offeringId), query)
      const output = [
        [
          'Student ID',
          'Student',
          'Account',
          ...all.flatMap((a) => [
            `${a.title} score`,
            `${a.title} max`,
            `${a.title} weight`,
            `${a.title} state`,
          ]),
          'Overall / 10',
          'Result',
          'Total weight',
          'Published weight',
        ],
        ...rows.map((r) => [
          r.studentId,
          r.displayName,
          r.accountStatus,
          ...all.flatMap((a) => {
            const c = r.cells.find((c) => c.activityId === a.activityId && c.kind === a.kind)!
            return [c.score ?? '', c.maxScore, c.weight, c.state]
          }),
          r.overall ?? '',
          r.final ? 'Final' : 'Provisional',
          r.totalWeight,
          r.availableWeight,
        ]),
      ]
      return new Blob(['\uFEFF' + output.map((row) => row.map(csvCell).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
    }),
}
function csvCell(value: string | number) {
  let s = String(value)
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s
  return '"' + s.replaceAll('"', '""') + '"'
}
