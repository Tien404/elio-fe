import type { Quiz } from './contracts'
import type { Page, PageQuery, Topic } from './course-contracts'
export type QuestionKind = 'SINGLE_CHOICE' | 'TRUE_FALSE'
export interface QuestionInput {
  prompt: string
  kind: QuestionKind
  options: Record<string, string>
  correctKey: string
  explanation: string | null
  points: number
}
export interface QuestionItem extends QuestionInput {
  id: number
  offeringId: number
  version: number
}
export interface QuestionSelection {
  questionItemId: number
  points: number
}
export interface CopiedQuestion extends QuestionInput {
  id: number
  questionItemId: number
  sourceVersion: number
  ordinal: number
}
export interface QuizInput {
  title: string
  openAt: string
  closeAt: string
  durationMinutes: number
  weight: number
  topicId: number | null
  mandatory: boolean
  questions: QuestionSelection[]
}
export interface QuizQuery extends PageQuery {
  offeringId?: number
  search?: string
  status?: string
}
export interface QuizView {
  quiz: Quiz
  offeringLabel: string
  teacher: boolean
  writable: boolean
  canStart: boolean
  scheduleLocked: boolean
  serverNow: string
  topicId: number | null
  mandatory: boolean
  weight: number
  attemptId: number | null
  attemptCount: number
  topics: Topic[]
  teacherContent?: {
    selections: QuestionSelection[]
    questions: CopiedQuestion[]
    published: boolean
  }
}
export interface QuizQuestionView {
  id: number
  ordinal: number
  prompt: string
  kind: QuestionKind
  options: Record<string, string>
}
export interface QuizAttempt {
  id: number
  quizId: number
  status: 'IN_PROGRESS' | 'SEALED'
  startedAt: string
  endAt: string
  sealedAt: string | null
  questions: QuizQuestionView[]
  answers: Record<string, string>
  version: number
}
export type Finalization = 'PENDING' | 'SUCCEEDED' | 'ERROR'
export interface ResultBreakdown {
  questionId: number
  correctKey: string
  explanation: string | null
  awardedPoints: number
}
export type QuizResultView =
  | {
      attemptId: number
      state: 'WAITING_FOR_CLOSE' | 'PROCESSING' | 'WAITING_FOR_RESTORE'
      maxScore: number
      releasedAt: null
      breakdown: []
    }
  | {
      attemptId: number
      state: 'PUBLISHED'
      maxScore: number
      releasedAt: string
      score: number
      breakdown: ResultBreakdown[]
    }
export interface AttemptView {
  attempt: QuizAttempt
  serverNow: string
  canAnswer: boolean
  teacher: boolean
  finalization: Finalization
  result: QuizResultView
  savedAt: Record<string, string>
  student: { id: number; displayName: string }
  quizTitle: string
  offeringId: number
  closeAt: string
  durationMinutes: number
}
export interface QuizService {
  bank(
    offeringId: number,
    query?: PageQuery & { search?: string; kind?: string },
  ): Promise<Page<QuestionItem>>
  question(id: number): Promise<QuestionItem>
  saveQuestion(
    offeringId: number,
    id: number | null,
    input: QuestionInput,
    expectedVersion?: number,
  ): Promise<QuestionItem>
  list(query?: QuizQuery): Promise<Page<QuizView>>
  get(id: number): Promise<QuizView>
  save(
    offeringId: number,
    id: number | null,
    input: QuizInput,
    expectedVersion?: number,
  ): Promise<QuizView>
  publish(id: number, expectedVersion: number): Promise<QuizView>
  archive(id: number, expectedVersion: number): Promise<QuizView>
  start(id: number): Promise<AttemptView>
  own(id: number): Promise<AttemptView | null>
  attempt(id: number): Promise<AttemptView>
  saveAnswer(
    id: number,
    questionId: number,
    selectedKey: string,
    expectedVersion: number,
  ): Promise<AttemptView>
  seal(id: number, expectedVersion: number): Promise<AttemptView>
  attempts(id: number, query?: PageQuery): Promise<Page<AttemptView>>
}
