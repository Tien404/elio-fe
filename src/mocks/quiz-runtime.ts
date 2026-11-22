import { sumQuizPoints } from '@/services/quiz-points'
import { getStore, now, persist } from './store'
import type { StoredAttempt } from './quiz-state'
import type { QuizResultView } from '@/services/quiz-contracts'
export function reconcileQuizClock(force = false) {
  const s = getStore()
  if (!s.quizEngine) return
  let changed = false
  for (const a of s.quizEngine.attempts) {
    const q = s.quizzes.find((q) => q.id === a.quizId)
    if (!q) continue
    if (a.status === 'IN_PROGRESS' && now() >= Date.parse(a.endAt)) {
      a.status = 'SEALED'
      a.sealedAt = a.endAt
      a.version++
      a.readyAt = new Date(now() + 1000).toISOString()
      changed = true
    }
    if (
      a.status === 'SEALED' &&
      a.finalization === 'PENDING' &&
      a.readyAt &&
      (force || now() >= Date.parse(a.readyAt)) &&
      s.quizEngine.workerMode !== 'pending'
    ) {
      if (s.quizEngine.workerMode === 'error') a.finalization = 'ERROR'
      else {
        const copies = s.quizEngine.details[q.id]?.published
        if (!copies?.length) {
          a.finalization = 'ERROR'
        } else {
          a.score = sumQuizPoints(
            copies.map((c) => (a.answers[String(c.id)] === c.correctKey ? c.points : 0)),
          )
          a.finalization = 'SUCCEEDED'
          a.finalizedAt = new Date(now()).toISOString()
        }
      }
      changed = true
    }
    if (
      a.finalization === 'SUCCEEDED' &&
      !a.releasedAt &&
      (q.releasePolicy === 'IMMEDIATE' || now() >= Date.parse(q.closeAt)) &&
      s.offerings.find((o) => o.id === q.offeringId)?.status === 'OPEN'
    ) {
      a.releasedAt = new Date(now()).toISOString()
      changed = true
      s.workspace.recipientEvents.push({
        id: Math.max(0, ...s.workspace.recipientEvents.map((e) => e.id)) + 1,
        offeringId: q.offeringId,
        recipientId: a.studentId,
        title: 'A quiz result is available.',
        targetUri: `/quiz-attempts/${a.id}`,
        occurredAt: a.releasedAt,
      })
    }
  }
  if (changed) {
    persist()
    window.dispatchEvent(new Event('elio:data'))
  }
}
export function resultFor(a: StoredAttempt): QuizResultView {
  const s = getStore(),
    q = s.quizzes.find((q) => q.id === a.quizId)!
  if (a.releasedAt && a.finalization === 'SUCCEEDED' && a.score !== null) {
    return {
      attemptId: a.id,
      state: 'PUBLISHED',
      maxScore: q.maxScore,
      score: a.score,
      releasedAt: a.releasedAt,
      breakdown: (now() >= Date.parse(q.closeAt)
        ? (s.quizEngine.details[q.id].published ?? [])
        : []
      ).map((c) => ({
        questionId: c.id,
        correctKey: c.correctKey,
        explanation: c.explanation,
        awardedPoints: a.answers[String(c.id)] === c.correctKey ? c.points : 0,
      })),
    }
  }
  return {
    attemptId: a.id,
    state:
      now() < Date.parse(q.closeAt)
        ? 'WAITING_FOR_CLOSE'
        : a.finalization === 'SUCCEEDED' &&
            s.offerings.find((o) => o.id === q.offeringId)?.status === 'ARCHIVED'
          ? 'WAITING_FOR_RESTORE'
          : 'PROCESSING',
    maxScore: q.maxScore,
    releasedAt: null,
    breakdown: [],
  }
}
export function quizResultProjection(quizId: number, studentId: number) {
  const q = getStore().quizzes.find((q) => q.id === quizId)
  const attempts = getStore().quizEngine.attempts.filter(
    (a) => a.quizId === quizId && a.studentId === studentId,
  )
  const released = attempts.filter((a) => a.releasedAt && a.score !== null)
  const a = attempts.at(-1)
  const scores = released.map((a) => a.score!)
  const counted = scores.length
    ? q?.gradingMethod === 'LATEST_ATTEMPT'
      ? scores.at(-1)!
      : q?.gradingMethod === 'AVERAGE'
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : Math.max(...scores)
    : null
  if (!a)
    return getStore().assessment.quizResults.find(
      (r) => r.quizId === quizId && r.studentId === studentId,
    )
  return {
    quizId,
    studentId,
    state: released.length
      ? ('RELEASED' as const)
      : a.finalization === 'ERROR'
        ? ('GRADING_ERROR' as const)
        : ('AWAITING_PUBLICATION' as const),
    score: counted,
    feedback: a.releasedAt ? 'Automatically graded from the published question snapshot.' : null,
  }
}
export function realAttemptGuards(offeringId: number) {
  const s = getStore()
  return s.quizEngine.attempts
    .filter((a) => s.quizzes.some((q) => q.id === a.quizId && q.offeringId === offeringId))
    .map((a) => ({
      id: a.id,
      active: a.status === 'IN_PROGRESS',
      endAt: a.endAt,
      finalization: a.finalization,
    }))
}
