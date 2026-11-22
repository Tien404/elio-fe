import type { GradeRecord, GradeRevision } from '@/services/contracts'
import type { ResultCell, GradebookView } from '@/services/assessment-contracts'
import { localPage } from './courses'
import type { PageQuery } from '@/services/course-contracts'

interface MainRevision {
  revisionNo: number
  sourceVersionNo: number | null
  grade: number
  feedback: string | null
  reason: string | null
  zeroReason: string | null
  isMissingZero: boolean
  specialMark: 'ABSENT' | 'BANNED' | null
  revisedBy: { id: number }
  revisedAt: string
}
export interface MainGrade {
  groupId: number | null
  publishedAt?: string | null
  id: number
  submissionId: number
  studentIds: number[]
  draftRevision: MainRevision | null
  publishedRevision: MainRevision | null
  revisions: MainRevision[] | null
  version: number
}
export function gradeRevision(gradeId: number, row: MainRevision): GradeRevision {
  return {
    gradeRecordId: gradeId,
    revisionNo: row.revisionNo,
    sourceVersionNo: row.sourceVersionNo,
    score: row.grade,
    feedback: row.feedback,
    isMissingZero: row.isMissingZero,
    zeroReason: row.zeroReason,
    reason: row.reason,
    specialMark: row.specialMark,
    revisedBy: row.revisedBy.id,
    createdAt: row.revisedAt,
  }
}
export function gradeView(row: MainGrade): GradeRecord {
  return {
    id: row.id,
    submissionId: row.submissionId,
    recipientStudentIds: row.studentIds,
    draftRevision: row.draftRevision ? gradeRevision(row.id, row.draftRevision) : null,
    publishedRevision: row.publishedRevision ? gradeRevision(row.id, row.publishedRevision) : null,
    version: row.version,
  }
}
export interface MainCell {
  state: string
  groupId: number | null
  activityId: number
  type: 'ASSIGNMENT' | 'QUIZ'
  title: string
  weight: number | null
  rangeMax: number
  grade: number | null
  contribution: number | null
  feedback: string | null
  status: string
  submitted: boolean
  gradeId: number | null
  specialCode?: number | null
}
export interface MainBook {
  rows: {
    student: { id: number; displayName: string }
    items: MainCell[]
    total: { grade: number | null; final: boolean; totalWeight: number; availableWeight: number }
  }[]
  columns: {
    activityId: number
    type: 'ASSIGNMENT' | 'QUIZ'
    title: string
    weight: number | null
    rangeMax: number
  }[]
  version: number
  writable: boolean
  serverNow: string
}
export function bookView(book: MainBook, query: PageQuery): GradebookView {
  const rows = book.rows.map((row) => ({
    studentId: row.student.id,
    membershipId: row.student.id,
    displayName: row.student.displayName,
    accountStatus: 'ACTIVE' as const,
    cells: row.items.map((c): ResultCell => ({
      activityId: c.activityId,
      kind: c.type,
      title: c.title,
      weight: c.weight ?? 0,
      maxScore: c.rangeMax,
      score: c.grade,
      specialCode: c.specialCode,
      contribution: c.contribution === null ? null : c.contribution / 10,
      feedback: c.feedback,
      state: c.state,
      complete: c.submitted,
      gradeRecordId: c.gradeId,
      groupId: c.groupId,
    })),
    overall: row.total.grade,
    final: row.total.final,
    totalWeight: row.total.totalWeight,
    availableWeight: row.total.availableWeight,
  }))
  return {
    rows: localPage(rows, query),
    activities: book.columns.map((c) => ({
      activityId: c.activityId,
      kind: c.type,
      title: c.title,
      weight: c.weight ?? 0,
      maxScore: c.rangeMax,
    })),
    version: book.version,
    writable: book.writable,
    teacher: true,
    serverNow: book.serverNow,
  }
}
