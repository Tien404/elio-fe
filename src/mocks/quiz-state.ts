import type { Quiz } from '@/services/contracts'
import type {
  QuestionItem,
  CopiedQuestion,
  QuestionSelection,
  QuizAttempt,
  Finalization,
} from '@/services/quiz-contracts'
export interface StoredAttempt extends Omit<QuizAttempt, 'questions'> {
  studentId: number
  finalization: Finalization
  readyAt: string | null
  savedAt: Record<string, string>
  finalizedAt: string | null
  releasedAt: string | null
  score: number | null
}
export interface QuizState {
  bank: QuestionItem[]
  details: Record<
    number,
    {
      topicId: number | null
      mandatory: boolean
      selections: QuestionSelection[]
      published: CopiedQuestion[] | null
    }
  >
  attempts: StoredAttempt[]
  workerMode: 'success' | 'pending' | 'error'
  fixtureOfferingId?: number
}
export function quizState(quizzes: Quiz[]): QuizState {
  const bank: QuestionItem[] = [],
    details: QuizState['details'] = {}
  for (const q of quizzes) {
    const question: QuestionItem = {
      id: bank.length + 1,
      offeringId: q.offeringId,
      prompt: 'Which action confirms an assignment submission?',
      kind: 'SINGLE_CHOICE',
      options: {
        A: 'Explicitly confirm the reviewed files',
        B: 'Select a file without confirming',
      },
      correctKey: 'A',
      explanation: 'Uploading stages a file. Explicit confirmation records the submission.',
      points: q.maxScore,
      version: 1,
    }
    bank.push(question)
    details[q.id] = {
      topicId: null,
      mandatory: true,
      selections: [{ questionItemId: question.id, points: q.maxScore }],
      published:
        q.status === 'DRAFT'
          ? null
          : [
              {
                ...question,
                id: bank.length,
                ordinal: 1,
                questionItemId: question.id,
                sourceVersion: 1,
              },
            ],
    }
  }
  return { bank, details, attempts: [], workerMode: 'success' }
}
