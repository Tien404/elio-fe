import type {
  AccountSummary,
  Assignment,
  FileAsset,
  GradeRecord,
  GradeRevision,
  Group,
  SubmissionReceipt,
} from './contracts'
import type { Page, PageQuery, Topic } from './course-contracts'
export interface SubmissionVersion {
  submissionId: number
  versionNo: number
  fileIds: number[]
  submittedByStudentId: number
  submittedAt: string
  isLate: boolean
  receiptCode: string
}
export interface Submission {
  id: number
  assignmentId: number
  subjectType: 'STUDENT' | 'GROUP'
  subjectId: number
  recipientStudentIds: number[]
  currentVersion: SubmissionVersion | null
  version: number
  status: 'NOT_SUBMITTED' | 'SUBMITTED'
}
export interface AssignmentInput {
  maxGroupSize?: number | null
  groupFormation?: 'SELF' | 'INSTRUCTOR'
  title: string
  instructions: string | null
  mode: Assignment['mode']
  status: Assignment['status']
  openAt: string
  dueAt: string
  cutoffAt: string
  maxScore: number
  weight: number
  topicId: number | null
  fileIds: number[]
  mandatory: boolean
}
export interface AssignmentView {
  assignment: Assignment
  topicId: number | null
  attachments: FileAsset[]
  mandatory: boolean
  teacher: boolean
  writable: boolean
  canSubmit: boolean
  serverNow: string
  offeringLabel: string
  topics: Topic[]
  submission: Submission | null
  group: Group | null
  ownGrade: GradeRevision | null
}
export interface AssignmentQuery extends PageQuery {
  offeringId?: number
  search?: string
  status?: string
  mode?: string
}
export interface GroupView {
  group: Group
  members: AccountSummary[]
}
export interface SubmissionView {
  submission: Submission | null
  history: SubmissionVersion[]
  files: FileAsset[]
  recipients: AccountSummary[]
  grade: GradeRecord | null
  revisions: GradeRevision[]
}
export interface ConfirmInput {
  expectedVersion: number
  groupId: number | null
  fileIds: number[]
}
export interface PreparedSubmission {
  actorId: number
  assignmentId: number
  requestKey: string
  payloadHash: string
  input: ConfirmInput
  files: FileAsset[]
  receipt: SubmissionReceipt | null
}
export interface GradeSubject {
  subjectId: number
  label: string
  recipients: AccountSummary[]
  submission: Submission | null
  grade: GradeRecord | null
}
export interface GradeQueue extends Page<GradeSubject> {
  canGrade: boolean
  serverNow: string
  subjectType: 'STUDENT' | 'GROUP'
}
export interface PublishedAssignmentResult {
  assignmentId: number
  offeringId: number
  groupId: number | null
  title: string
  maxScore: number
  publishedAt: string
  revision: GradeRevision
}
export interface GradeInput {
  specialMark?: 'ABSENT' | 'BANNED' | null
  subjectId: number
  submissionId: number | null
  gradeRecordId: number | null
  expectedSubmissionVersion: number
  expectedGradeVersion: number
  sourceVersionNo: number | null
  score: number
  feedback: string | null
  zeroReason: string | null
  reason: string | null
}
export interface ResultCell {
  specialCode?: number | null
  activityId: number
  kind: 'ASSIGNMENT' | 'QUIZ'
  title: string
  weight: number
  maxScore: number
  score: number | null
  contribution: number | null
  state: string
  feedback: string | null
  complete: boolean
  isMissingZero?: boolean
  gradeRecordId: number | null
  groupId: number | null
}
export interface ResultRow {
  studentId: number
  membershipId: number
  displayName: string
  accountStatus: AccountSummary['status']
  cells: ResultCell[]
  overall: number | null
  final: boolean
  totalWeight: number
  availableWeight: number
}
export interface ResultQuery extends PageQuery {
  search?: string
  state?: 'ALL' | 'FINAL' | 'PROVISIONAL'
  activityId?: number
}
export interface GradebookView {
  rows: Page<ResultRow>
  activities: Pick<ResultCell, 'activityId' | 'kind' | 'title' | 'weight' | 'maxScore'>[]
  version: number
  writable: boolean
  teacher: boolean
  serverNow: string
}
export interface AssessmentService {
  list(query?: AssignmentQuery): Promise<Page<AssignmentView>>
  get(id: number): Promise<AssignmentView>
  save(
    offeringId: number,
    id: number | null,
    input: AssignmentInput,
    expectedVersion?: number,
  ): Promise<AssignmentView>
  joinGroup(id: number): Promise<void>
  leaveGroup(id: number): Promise<void>
  releaseGrades(id: number): Promise<void>
  groups(id: number, query?: PageQuery): Promise<Page<GroupView>>
  candidates(id: number, groupId?: number): Promise<AccountSummary[]>
  saveGroup(
    id: number,
    groupId: number | null,
    input: Pick<Group, 'name' | 'memberStudentIds'>,
    expectedVersion?: number,
  ): Promise<GroupView>
  stream(id: number, subjectId?: number, submissionId?: number): Promise<SubmissionView>
  prepare(id: number, input: ConfirmInput, requestKey: string): Promise<PreparedSubmission>
  confirm(id: number, prepared: PreparedSubmission): Promise<SubmissionReceipt>
  receipt(id: number, key: string): Promise<SubmissionReceipt | null>
  queue(id: number, query?: PageQuery): Promise<GradeQueue>
  saveGrade(id: number, input: GradeInput): Promise<GradeRecord>
  publishGrade(
    id: number,
    gradeId: number,
    revisionNo: number,
    expectedVersion: number,
  ): Promise<GradeRecord>
  gradebook(offeringId: number, query?: ResultQuery): Promise<GradebookView>
  weights(
    offeringId: number,
    values: { id: number; kind: 'ASSIGNMENT' | 'QUIZ'; weight: number }[],
    expectedVersion: number,
  ): Promise<void>
  csv(offeringId: number, query?: ResultQuery): Promise<Blob>
}
