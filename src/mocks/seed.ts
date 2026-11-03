import { personalState } from '@/mocks/personal-state'
import { quizState } from '@/mocks/quiz-state'
import { assessmentState } from '@/mocks/assessment-state'
import type { Submission } from '@/services/assessment-contracts'
import { workspaceState } from '@/mocks/workspace-state'
import type {
  Assignment,
  FileAsset,
  GradeRecord,
  Group,
  MeView,
  Membership,
  Offering,
  Quiz,
  Resource,
  SubmissionReceipt,
} from '@/services/contracts'

export const DEMO_PASSWORD = 'Elio-demo-2026!'
export function seed() {
  const people: [string, string, MeView['account']['role'], boolean, boolean][] = [
    ['student', 'Jamie Morgan', 'STUDENT', false, false],
    ['lead', 'Alex Rivera', 'INSTRUCTOR', false, true],
    ['co', 'Taylor Reed', 'INSTRUCTOR', false, false],
    ['admin', 'Jordan Ellis', 'ADMIN', false, false],
    ['outsider', 'Casey Lane', 'STUDENT', false, false],
    ['locked', 'Sam Lee', 'STUDENT', false, false],
    ['temporary', 'Robin Chen', 'STUDENT', true, false],
    ['student2', 'Avery Quinn', 'STUDENT', false, false],
  ]
  const accounts: MeView[] = people.map(
    ([email, displayName, role, mustChangePassword, canCreateCourse], i) => ({
      account: {
        id: i + 1,
        displayName,
        role,
        mustChangePassword,
        status: email === 'locked' ? 'LOCKED' : 'ACTIVE',
      },
      email: `${email}@demo.elio.test`,
      canCreateCourse,
      version: 1,
    }),
  )
  const offerings: Offering[] = [
    {
      id: 101,
      courseId: 11,
      courseCode: 'CO3001',
      title: 'Software Engineering',
      semester: 'HK261',
      sectionCode: 'L01',
      status: 'OPEN',
      leadMembershipId: 202,
      version: 1,
    },
  ]
  const memberships: Membership[] = [1, 2, 3, 6, 7, 8].map((id) => ({
    id: 200 + id,
    offeringId: 101,
    account: accounts[id - 1].account,
    role: id === 2 || id === 3 ? 'INSTRUCTOR' : 'STUDENT',
    teachingRole: id === 2 ? 'LEAD' : id === 3 ? 'CO_INSTRUCTOR' : null,
    status: 'ACTIVE',
    version: 1,
  }))
  const materials: Resource[] = [
    {
      id: 301,
      offeringId: 101,
      title: 'Welcome to Software Engineering',
      body: 'Explore requirements, design and teamwork in this demonstration course.',
      externalUrl: null,
      status: 'PUBLISHED',
      fileIds: [],
      kind: 'TEXT',
      version: 1,
    },
  ]
  const assignments: Assignment[] = [0, 1].map((i) => ({
    id: 401 + i,
    offeringId: 101,
    title: i ? 'Team design project' : 'Requirements analysis',
    instructions: 'Submit your analysis as a file.',
    mode: i ? 'GROUP' : 'INDIVIDUAL',
    status: 'PUBLISHED',
    openAt: '2026-11-01T00:00:00Z',
    dueAt: i ? '2026-11-04T10:00:00Z' : '2026-11-15T10:00:00Z',
    cutoffAt: i ? '2026-11-04T11:00:00Z' : '2026-11-16T10:00:00Z',
    maxScore: 10,
    weight: i ? 60 : 40,
    version: 1,
  }))
  const groups: Group[] = [
    {
      id: 501,
      assignmentId: 402,
      name: 'Team One',
      memberStudentIds: [1, 6, 8],
      lockedAt: '2026-11-03T03:00:00Z',
      version: 1,
    },
  ]
  const receipts: SubmissionReceipt[] = [
    {
      submissionId: 601,
      versionNo: 1,
      receiptCode: 'DEMO-601-1',
      submittedAt: '2026-11-03T03:00:00Z',
    },
  ]
  const submissions: Submission[] = [
    {
      id: 601,
      assignmentId: 402,
      subjectType: 'GROUP' as const,
      subjectId: 501,
      recipientStudentIds: [1, 6, 8],
      currentVersion: {
        submissionId: 601,
        versionNo: 1,
        fileIds: [701],
        submittedByStudentId: 1,
        submittedAt: receipts[0].submittedAt,
        isLate: false,
        receiptCode: receipts[0].receiptCode,
      },
      version: 1,
      status: 'SUBMITTED' as const,
    },
  ]
  const files: FileAsset[] = [
    {
      id: 701,
      offeringId: 101,
      originalName: 'demo-design.txt',
      mediaType: 'text/plain',
      byteSize: 22,
      sha256: '22bbe3d9c21a70099d62d7f7b46ca840a7f1bc61edd072faac961b901715f607',
      state: 'ATTACHED' as const,
      leaseExpiresAt: '2026-11-06T03:00:00Z',
      purpose: 'SUBMISSION' as const,
    },
  ]
  const revision = {
    gradeRecordId: 801,
    revisionNo: 1,
    sourceVersionNo: 1,
    score: 8,
    feedback: 'Clear design.',
    isMissingZero: false,
    zeroReason: null,
    reason: null,
    revisedBy: 2,
    createdAt: '2026-11-05T03:00:00Z',
  }
  const grades: GradeRecord[] = [
    {
      id: 801,
      submissionId: 601,
      recipientStudentIds: [1, 6, 8],
      draftRevision: revision,
      publishedRevision: revision,
      version: 1,
    },
  ]
  const quizzes: Quiz[] = [
    {
      id: 901,
      offeringId: 101,
      title: 'Requirements check',
      status: 'PUBLISHED',
      openAt: '2026-11-01T00:00:00Z',
      closeAt: '2026-11-20T10:00:00Z',
      durationMinutes: 20,
      maxScore: 10,
      questionCount: 1,
      version: 1,
    },
  ]
  return {
    schemaVersion: 1 as const,
    personal: personalState(),
    workspace: workspaceState({ offerings, materials, memberships }),
    assessment: assessmentState({ assignments, submissions, grades }),
    accounts,
    offerings,
    memberships,
    materials,
    assignments,
    groups,
    submissions,
    receipts,
    files,
    grades,
    quizzes,
    quizEngine: quizState(quizzes),
    session: null as { accountId: number; expiresAt: string } | null,
    stagingOwners: {} as Record<number, number>,
    passwordVerifiers: {} as Record<number, string>,
    clockOffset: 0,
  }
}
export type DemoStore = ReturnType<typeof seed>
