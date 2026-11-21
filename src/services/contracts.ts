export type Role = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN'
export interface AccountSummary {
  id: number
  displayName: string
  status: 'ACTIVE' | 'LOCKED'
  role: Role
  mustChangePassword: boolean
}
export interface MeView {
  account: AccountSummary
  email: string
  canCreateCourse: boolean
  version: number
}
export interface SessionView {
  account: AccountSummary
  csrfToken: string
  absoluteExpiresAt: string
  restricted: boolean
}
export interface Identity {
  me: MeView
  session: SessionView
}
export interface LoginRequest {
  email: string
  password: string
}
export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}
export interface Offering {
  id: number
  courseCode: string
  title: string
  status: 'DRAFT' | 'OPEN' | 'ARCHIVED'
  leadMembershipId: number
  version: number
  courseId: number
  semester: string
  sectionCode: string
}
export interface Membership {
  id: number
  offeringId: number
  account: AccountSummary
  role: 'STUDENT' | 'INSTRUCTOR'
  teachingRole: 'LEAD' | 'CO_INSTRUCTOR' | null
  status: 'ACTIVE' | 'REMOVED'
  version: number
}
export interface Resource {
  topicId?: number
  id: number
  offeringId: number
  title: string
  body: string | null
  externalUrl: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  fileIds: number[]
  version: number
  kind: 'TEXT' | 'LINK' | 'FILE'
}
export interface Assignment {
  maxGroupSize?: number | null
  groupFormation?: 'SELF' | 'INSTRUCTOR'
  id: number
  offeringId: number
  title: string
  instructions: string | null
  mode: 'INDIVIDUAL' | 'GROUP'
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  openAt: string
  dueAt: string
  cutoffAt: string
  maxScore: number
  weight: number
  version: number
}
export interface Group {
  id: number
  assignmentId: number
  name: string
  memberStudentIds: number[]
  lockedAt: string | null
  version: number
}
export interface SubmissionReceipt {
  submissionId: number
  versionNo: number
  receiptCode: string
  submittedAt: string
}
export interface GradeRevision {
  specialMark?: 'ABSENT' | 'BANNED' | null
  gradeRecordId: number
  revisionNo: number
  sourceVersionNo: number | null
  score: number
  feedback: string | null
  isMissingZero: boolean
  zeroReason: string | null
  reason: string | null
  revisedBy: number
  createdAt: string
}
export interface GradeRecord {
  id: number
  submissionId: number
  recipientStudentIds: number[]
  draftRevision: GradeRevision | null
  publishedRevision: GradeRevision | null
  version: number
}
export interface Quiz {
  maxAttempts?: number
  gradingMethod?: 'HIGHEST_SCORE' | 'LATEST_ATTEMPT' | 'AVERAGE'
  releasePolicy?: 'AFTER_CLOSE' | 'IMMEDIATE'
  id: number
  offeringId: number
  title: string
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  openAt: string
  closeAt: string
  durationMinutes: number
  maxScore: number
  questionCount: number
  version: number
}
export interface CalendarItem {
  id: string
  offeringId: number
  kind: 'ASSIGNMENT_DUE' | 'QUIZ_OPEN' | 'QUIZ_CLOSE'
  section: string
  status: string
  type?: string
  title: string
  at: string
  targetUri: string
}
export interface IdentityService {
  restore(): Promise<Identity | null>
  login(request: LoginRequest): Promise<Identity>
  logout(): Promise<void>
  updateProfile(displayName: string, expectedVersion: number): Promise<Identity>
  changePassword(request: ChangePasswordRequest): Promise<void>
}
export interface WorkspaceService {
  listOfferings(): Promise<Offering[]>
  downloadDemoAsset(): Promise<Blob>
}
export type FilePurpose = 'MATERIAL' | 'ASSIGNMENT_ATTACHMENT' | 'SUBMISSION'
export interface FileAsset {
  id: number
  offeringId: number
  originalName: string
  mediaType: string
  byteSize: number
  sha256: string
  state: 'STAGING' | 'ATTACHED' | 'EXPIRED'
  leaseExpiresAt: string
  purpose: FilePurpose
}
export interface FileService {
  reselect(fileId: number, file: File): Promise<FileAsset>
  stage(
    file: File,
    offeringId: number,
    purpose: FilePurpose,
    assignmentId?: number,
  ): Promise<FileAsset>
  download(fileId: number): Promise<Blob>
}
