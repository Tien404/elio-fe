import type { QuestionInput, QuestionItem } from '@/services/quiz-contracts'

export interface MainQuestion {
  sourceQuestionId?: number | null
  sourceVersion?: number | null
  id: number
  offeringId: number
  version: number
  type: 'SINGLE_CHOICE' | 'TRUE_FALSE'
  text: string
  options: string[] | null
  correctOption: number | null
  correctAnswer: boolean | null
  explanation: string | null
  points: number
  position?: number
}
export function questionView(row: MainQuestion): QuestionItem {
  return {
    id: row.id,
    offeringId: row.offeringId,
    version: row.version,
    kind: row.type,
    prompt: row.text,
    options:
      row.type === 'TRUE_FALSE'
        ? { '1': 'True', '2': 'False' }
        : Object.fromEntries((row.options ?? []).map((text, i) => [String(i + 1), text])),
    correctKey: String(row.type === 'TRUE_FALSE' ? (row.correctAnswer ? 1 : 2) : row.correctOption),
    explanation: row.explanation,
    points: row.points,
  }
}
export function questionBody(input: QuestionInput) {
  return {
    type: input.kind,
    text: input.prompt,
    options: input.kind === 'SINGLE_CHOICE' ? Object.values(input.options) : null,
    correctOption: input.kind === 'SINGLE_CHOICE' ? Number(input.correctKey) : null,
    correctAnswer: input.kind === 'TRUE_FALSE' ? input.correctKey === '1' : null,
    explanation: input.explanation,
    points: input.points,
  }
}
