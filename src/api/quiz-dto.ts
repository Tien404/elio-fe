import type { AttemptView, QuizResultView } from '@/services/quiz-contracts'
import { currentIdentity, http } from './http'

import type { MainQuestion } from './question-dto'

export { questionView, questionBody, type MainQuestion } from './question-dto'

export interface MainQuiz {
  id: number
  offeringId: number
  title: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  topicId: number | null
  openAt: string
  closeAt: string
  durationMinutes: number
  totalPoints: number
  weight: number
  maxAttempts: number
  gradingMethod: 'HIGHEST_SCORE' | 'LATEST_ATTEMPT' | 'AVERAGE'
  releasePolicy: 'AFTER_CLOSE' | 'IMMEDIATE'
  mandatory: boolean
  serverNow: string
  scheduleLocked: boolean
  questionCount: number
  version: number
  questions?: MainQuestion[] | null
}
export interface MainAttempt {
  student: { id: number; displayName: string }
  finalization: AttemptView['finalization']
  savedAt: Record<string, string>
  id: number
  quizId: number
  attemptNo: number
  version: number
  startedAt: string
  endsAt: string
  submittedAt: string | null
  status: 'IN_PROGRESS' | 'FINISHED'
  releasedAt: string | null
  score: number | null
  serverNow: string
  questions: {
    id: number
    position: number
    text: string
    type: 'SINGLE_CHOICE' | 'TRUE_FALSE'
    points: number
    options: { number: number; text: string }[]
    selectedOption: number | null
  }[]
}
export interface MainOwnAttempts {
  attempts: MainAttempt[]
  canStart: boolean
  attemptsUsed: number
  countedScore: number | null
}
interface MainResult {
  state: QuizResultView['state']
  releasedAt: string | null
  score: number | null
  maxScore: number
  answersShown: boolean
  questions: {
    id: number
    correctOption: number | null
    explanation: string | null
    correct: boolean | null
    points: number
  }[]
}
export async function attemptView(row: MainAttempt): Promise<AttemptView> {
  const quiz = await http<MainQuiz>(`/quizzes/${row.quizId}`)
  const teacher = currentIdentity()?.me.account.role === 'INSTRUCTOR'
  let result: QuizResultView = {
    attemptId: row.id,
    state: 'PROCESSING',
    maxScore: quiz.totalPoints,
    releasedAt: null,
    breakdown: [],
  }
  if (row.status === 'FINISHED') {
    const dto = await http<MainResult>(`/quiz-attempts/${row.id}/result`)
    result =
      dto.state === 'PUBLISHED' && dto.score !== null
        ? {
            attemptId: row.id,
            state: 'PUBLISHED',
            maxScore: dto.maxScore,
            releasedAt: dto.releasedAt!,
            score: dto.score,
            breakdown: dto.answersShown
              ? dto.questions.map((q) => ({
                  questionId: q.id,
                  correctKey: String(q.correctOption),
                  explanation: q.explanation,
                  awardedPoints: q.correct ? q.points : 0,
                }))
              : [],
          }
        : {
            attemptId: row.id,
            state: dto.state === 'PUBLISHED' ? 'PROCESSING' : dto.state,
            maxScore: dto.maxScore,
            releasedAt: null,
            breakdown: [],
          }
  }
  return {
    attempt: {
      attemptNo: row.attemptNo,
      id: row.id,
      quizId: row.quizId,
      version: row.version,
      status: row.status === 'FINISHED' ? 'SEALED' : 'IN_PROGRESS',
      startedAt: row.startedAt,
      endAt: row.endsAt,
      sealedAt: row.submittedAt,
      questions: row.questions.map((q) => ({
        id: q.id,
        ordinal: q.position,
        prompt: q.text,
        kind: q.type,
        options: Object.fromEntries(q.options.map((o) => [String(o.number), o.text])),
      })),
      answers: Object.fromEntries(
        row.questions
          .filter((q) => q.selectedOption !== null)
          .map((q) => [String(q.id), String(q.selectedOption)]),
      ),
    },
    serverNow: row.serverNow,
    canAnswer: !teacher && row.status === 'IN_PROGRESS',
    teacher,
    finalization: row.finalization,
    result,
    savedAt: row.savedAt,
    student: row.student,
    quizTitle: quiz.title,
    offeringId: quiz.offeringId,
    closeAt: quiz.closeAt,
    durationMinutes: quiz.durationMinutes,
  }
}
