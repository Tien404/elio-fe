import type {
  ConfirmInput,
  PreparedSubmission,
  Submission,
  SubmissionView,
} from '@/services/assessment-contracts'
import { ServiceError } from '@/services/errors'
import { assignmentAccess, groupFor, streamFor, validateAssets } from './assignment-service'
import { commit, getStore, now } from './store'
import { request } from './scenarios'
import { account, nextId, version, notify } from './policy'
let loseNextResponse = false
export function loseNextConfirmResponse() {
  loseNextResponse = true
}
export async function payloadHash(input: ConfirmInput) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(
      JSON.stringify({
        expectedVersion: input.expectedVersion,
        groupId: input.groupId ?? null,
        fileIds: input.fileIds,
      }),
    ),
  )
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
function ownSubject(id: number, inputGroup?: number | null) {
  const ctx = assignmentAccess(id),
    { a, me, teacher } = ctx
  if (teacher || me.account.role !== 'STUDENT')
    throw new ServiceError(403, 'Current student access is required to submit.')
  const group = a.mode === 'GROUP' ? groupFor(a, me.account.id) : null
  if (a.mode === 'GROUP' && (!group || (inputGroup !== undefined && inputGroup !== group.id)))
    throw new ServiceError(
      403,
      'You are not assigned to this group. Ask your instructor to assign you before submitting.',
    )
  if (a.mode === 'INDIVIDUAL' && inputGroup)
    throw new ServiceError(422, 'Individual assignments cannot accept a group ID.')
  return { ...ctx, group, subjectId: group?.id ?? me.account.id }
}
export function makeStream(
  a: import('@/services/contracts').Assignment,
  subjectId: number,
): Submission {
  const s = getStore(),
    group =
      a.mode === 'GROUP'
        ? s.groups.find((g) => g.id === subjectId && g.assignmentId === a.id)
        : null
  if (a.mode === 'GROUP' && !group) throw new ServiceError(404, 'Group not found.')
  if (
    a.mode === 'INDIVIDUAL' &&
    !s.memberships.some(
      (m) =>
        m.offeringId === a.offeringId &&
        m.account.id === subjectId &&
        m.role === 'STUDENT' &&
        m.status === 'ACTIVE',
    )
  )
    throw new ServiceError(403, 'Student is no longer assigned to this section.')
  const row: Submission = {
    id: nextId(s.submissions),
    assignmentId: a.id,
    subjectType: a.mode === 'GROUP' ? 'GROUP' : 'STUDENT',
    subjectId,
    recipientStudentIds: [...(group?.memberStudentIds ?? [subjectId])],
    currentVersion: null,
    version: 0,
    status: 'NOT_SUBMITTED',
  }
  if (group && !group.lockedAt) {
    group.lockedAt = new Date(now()).toISOString()
    group.version++
  }
  s.submissions.push(row)
  return row
}
export function streamView(id: number, subjectId?: number): SubmissionView {
  const { a, teacher, me, store: s } = assignmentAccess(id)
  const own = teacher ? null : a.mode === 'GROUP' ? groupFor(a, me.account.id)?.id : me.account.id
  if (!teacher && subjectId !== undefined && subjectId !== own)
    throw new ServiceError(403, 'Only your own submission stream is available.')
  const stream = streamFor(a, subjectId ?? own ?? 0),
    g = s.grades.find((g) => g.submissionId === stream?.id)
  const history = s.assessment.history
    .filter((v) => v.submissionId === stream?.id)
    .sort((a, b) => b.versionNo - a.versionNo)
  return {
    submission: stream,
    history,
    files: s.files.filter((f) => history.some((v) => v.fileIds.includes(f.id))),
    recipients: stream?.recipientStudentIds.map(account) ?? [],
    grade: g ? { ...g, draftRevision: teacher ? g.draftRevision : null } : null,
    revisions: teacher ? s.assessment.revisions.filter((r) => r.gradeRecordId === g?.id) : [],
  }
}
export const submissionMethods = {
  stream: (id: number, subjectId?: number) => request(() => streamView(id, subjectId)),
  prepare: (id: number, input: ConfirmInput, requestKey: string) =>
    request(async () => {
      const { a, me, subjectId } = ownSubject(id, input.groupId)
      validateKey(requestKey)
      validateSubmitTime(id)
      version(streamFor(a, subjectId)?.version ?? 0, input.expectedVersion)
      const files = validateAssets(
        input.fileIds,
        a.offeringId,
        'SUBMISSION',
        me.account.id,
        existingStreamFiles(a.id, subjectId),
      )
      return {
        actorId: me.account.id,
        assignmentId: id,
        requestKey,
        payloadHash: await payloadHash(input),
        input,
        files,
        receipt: null,
      }
    }),
  confirm: (id: number, prepared: PreparedSubmission) =>
    request(async () => {
      const { a, me } = assignmentAccess(id)
      if (me.account.role !== 'STUDENT')
        throw new ServiceError(403, 'Current student access is required.')
      validateKey(prepared.requestKey)
      if (prepared.actorId !== me.account.id || prepared.assignmentId !== id)
        throw new ServiceError(403, 'This confirmation belongs to another account or assignment.')
      const hash = await payloadHash(prepared.input)
      if (hash !== prepared.payloadHash)
        throw new ServiceError(
          409,
          'Payload hash changed. Review the exact files and stream version.',
        )
      const s = getStore(),
        old = s.assessment.confirmations.find(
          (c) =>
            c.actorId === me.account.id &&
            c.assignmentId === id &&
            c.requestKey === prepared.requestKey,
        )
      if (old) {
        const stream = s.submissions.find((sub) => sub.id === old.receipt.submissionId)
        if (!stream?.recipientStudentIds.includes(me.account.id))
          throw new ServiceError(403, 'You no longer have access to this receipt.')
        if (old.payloadHash !== hash)
          throw new ServiceError(
            409,
            'This idempotency key was already used with a different payload.',
          )
        return old.receipt
      }
      const { subjectId } = ownSubject(id, prepared.input.groupId)
      validateSubmitTime(id)
      const receipt = commit(() => {
        let stream = streamFor(a, subjectId)
        version(stream?.version ?? 0, prepared.input.expectedVersion)
        if (s.grades.some((g) => g.submissionId === stream?.id))
          throw new ServiceError(
            409,
            'A grade or missing-zero has already been saved. Submission is closed.',
          )
        const files = validateAssets(
          prepared.input.fileIds,
          a.offeringId,
          'SUBMISSION',
          me.account.id,
          existingStreamFiles(a.id, subjectId),
        )
        stream ??= makeStream(a, subjectId)
        const at = new Date(now()).toISOString(),
          number = (stream.currentVersion?.versionNo ?? 0) + 1
        const receipt = {
          submissionId: stream.id,
          versionNo: number,
          receiptCode: `DEMO-${stream.id}-${number}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          submittedAt: at,
        }
        const revision = {
          submissionId: stream.id,
          versionNo: number,
          fileIds: [...prepared.input.fileIds],
          submittedByStudentId: me.account.id,
          submittedAt: at,
          isLate: now() > Date.parse(a.dueAt),
          receiptCode: receipt.receiptCode,
        }
        stream.currentVersion = revision
        stream.status = 'SUBMITTED'
        stream.version++
        s.assessment.history.push(revision)
        s.receipts.push(receipt)
        files.forEach((f) => (f.state = 'ATTACHED'))
        s.assessment.confirmations.push({ ...prepared, receipt })
        notify(
          a.offeringId,
          'A submission was confirmed.',
          `/assignments/${id}/grading`,
          s.memberships
            .filter((m) => m.offeringId === a.offeringId && m.role === 'INSTRUCTOR')
            .map((m) => m.account.id),
        )
        return receipt
      })
      if (loseNextResponse) {
        loseNextResponse = false
        throw new ServiceError(
          0,
          'Confirmation response was lost. Do not start a new request. Check receipt or retry the same key and payload.',
        )
      }
      return receipt
    }),
  receipt: (id: number, key: string) =>
    request(() => {
      const { me } = assignmentAccess(id)
      validateKey(key)
      const saved = getStore().assessment.confirmations.find(
        (c) => c.actorId === me.account.id && c.assignmentId === id && c.requestKey === key,
      )
      if (!saved) return null
      const stream = getStore().submissions.find((s) => s.id === saved.receipt.submissionId)
      if (!stream?.recipientStudentIds.includes(me.account.id))
        throw new ServiceError(403, 'You no longer have access to this receipt.')
      return saved.receipt
    }),
}
function validateKey(key: string) {
  if (!/^[A-Za-z0-9-]{16,100}$/.test(key))
    throw new ServiceError(
      422,
      'Use a stable confirmation key containing 16–100 letters, digits or hyphens.',
    )
}
function validateSubmitTime(id: number) {
  const { a, offering } = assignmentAccess(id)
  if (
    offering.status !== 'OPEN' ||
    a.status !== 'PUBLISHED' ||
    now() < Date.parse(a.openAt) ||
    now() > Date.parse(a.cutoffAt)
  )
    throw new ServiceError(
      409,
      'New confirmations require an open section and the assignment submission window. Check receipt for an earlier request.',
    )
}

function existingStreamFiles(assignmentId: number, subjectId: number) {
  const a = getStore().assignments.find((a) => a.id === assignmentId)!
  const stream = streamFor(a, subjectId)
  return getStore()
    .assessment.history.filter((v) => v.submissionId === stream?.id)
    .flatMap((v) => v.fileIds)
}
