import type { QuizResultView, QuizView } from './quiz-contracts'

export function quizAvailability(view: QuizView) {
  const now = Date.parse(view.serverNow)
  if (view.quiz.status === 'DRAFT') return 'Draft'
  if (
    view.quiz.status === 'ARCHIVED' ||
    view.offeringStatus === 'ARCHIVED' ||
    now >= Date.parse(view.quiz.closeAt)
  )
    return 'Closed'
  if (view.offeringStatus === 'DRAFT') return 'Unavailable'
  if (now < Date.parse(view.quiz.openAt)) return 'Not open yet'
  return view.teacher || view.canStart || view.attemptId ? 'Open' : 'Unavailable'
}

export const quizResultStatus: Record<QuizResultView['state'], string> = {
  PROCESSING: 'Processing',
  GRADING_ERROR: 'Grading error',
  WAITING_FOR_CLOSE: 'Waiting for quiz close',
  WAITING_FOR_RESTORE: 'Waiting for course restore',
  PUBLISHED: 'Published',
}

export function quizOptionLabel(key: string) {
  const n = Number(key)
  return Number.isInteger(n) && n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : key
}
