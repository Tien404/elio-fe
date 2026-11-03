import type { Assignment, GradeRecord } from '@/services/contracts'
import type {
  Submission,
  SubmissionVersion,
  PreparedSubmission,
} from '@/services/assessment-contracts'
export interface AssessmentState {
  meta: Record<
    number,
    { topicId: number | null; fileIds: number[]; mandatory: boolean; everPublished: boolean }
  >
  history: SubmissionVersion[]
  revisions: NonNullable<GradeRecord['draftRevision']>[]
  confirmations: (PreparedSubmission & { receipt: NonNullable<PreparedSubmission['receipt']> })[]
  weightVersions: Record<number, number>
  quizResults: {
    quizId: number
    studentId: number
    state: 'NOT_STARTED' | 'AWAITING_PUBLICATION' | 'GRADING_ERROR' | 'RELEASED'
    score: number | null
    feedback: string | null
  }[]
  quizWeights: Record<number, number>
  fixtureOfferingId?: number
}
export function assessmentState(base: {
  assignments: Assignment[]
  submissions: Submission[]
  grades: GradeRecord[]
}): AssessmentState {
  return {
    meta: Object.fromEntries(
      base.assignments.map((a) => [
        a.id,
        { topicId: null, fileIds: [], mandatory: true, everPublished: a.status !== 'DRAFT' },
      ]),
    ),
    history: base.submissions.flatMap((s) => (s.currentVersion ? [s.currentVersion] : [])),
    revisions: base.grades.flatMap((g) => (g.draftRevision ? [g.draftRevision] : [])),
    confirmations: [],
    weightVersions: {},
    quizResults: [],
    quizWeights: {},
  }
}
