import { current } from './services'
import { getStore, commit, now } from './store'
import { requireAcademic, nextId, account } from './policy'
import { reconcileQuizClock } from './quiz-runtime'
import { ServiceError } from '@/services/errors'
export function setQuizWorkerMode(mode: 'success' | 'pending' | 'error') {
  current()
  commit(() => {
    getStore().quizEngine.workerMode = mode
  })
  return `Mock quiz worker mode: ${mode}. No score override or regrade.`
}
export function runQuizWorker() {
  current()
  reconcileQuizClock(true)
  return 'Mock worker reconciled expired/sealed attempts and eligible releases.'
}
export function retryFailedQuizFinalizations() {
  current()
  commit(() => {
    for (const a of getStore().quizEngine.attempts)
      if (a.finalization === 'ERROR') {
        a.finalization = 'PENDING'
        a.readyAt = new Date(now()).toISOString()
      }
  })
  reconcileQuizClock(true)
  return 'Failed finalizations retried from durable saved answers. Successfully finalized attempts are unchanged.'
}
export function prepareQuizScenarios() {
  const me = current().me
  if (me.account.role !== 'INSTRUCTOR')
    throw new ServiceError(403, 'Sign in as an instructor to prepare quiz fixtures.')
  return commit(() => {
    const s = getStore()
    if (
      s.quizEngine.fixtureOfferingId &&
      s.offerings.some((o) => o.id === s.quizEngine.fixtureOfferingId)
    )
      return s.quizEngine.fixtureOfferingId
    const offeringId = nextId(s.offerings),
      lead = nextId(s.memberships),
      catalog = s.workspace.catalog[0]
    s.offerings.push({
      id: offeringId,
      courseId: catalog.id,
      courseCode: catalog.courseCode,
      title: 'Quiz Studio',
      semester: 'DEMO',
      sectionCode: `FE03-${offeringId}`,
      status: 'OPEN',
      leadMembershipId: lead,
      version: 1,
    })
    const people = [me.account.id, ...[2, 3, 1, 8, 6].filter((id) => id !== me.account.id)]
    people.forEach((id, i) =>
      s.memberships.push({
        id: lead + i,
        offeringId,
        account: account(id),
        role: account(id).role === 'INSTRUCTOR' ? 'INSTRUCTOR' : 'STUDENT',
        teachingRole:
          id === me.account.id
            ? 'LEAD'
            : account(id).role === 'INSTRUCTOR'
              ? 'CO_INSTRUCTOR'
              : null,
        status: 'ACTIVE',
        version: 1,
      }),
    )
    const code = offeringId.toString(36).toUpperCase().padStart(6, 'Q')
    s.workspace.details[offeringId] = {
      learningInformation:
        'Publish a quiz, save durable answers and review finalization and release.',
      joinCode: code,
      joinEnabled: true,
    }
    s.workspace.usedCodes.push(code)
    const topic = nextId(s.workspace.topics)
    s.workspace.topics.push({
      id: topic,
      offeringId,
      title: 'Quiz foundations',
      position: 1,
      version: 1,
    })
    const questionId = nextId(s.quizEngine.bank)
    s.quizEngine.bank.push(
      {
        id: questionId,
        offeringId,
        prompt: 'Which action records a submitted assignment?',
        kind: 'SINGLE_CHOICE',
        options: {
          A: 'Uploading files only',
          B: 'Explicit confirmation after review',
          C: 'Opening the assignment',
          D: 'Selecting files only',
        },
        correctKey: 'B',
        explanation: 'Upload stages files. Explicit confirmation creates a receipt.',
        points: 4,
        version: 1,
      },
      {
        id: questionId + 1,
        offeringId,
        prompt: 'Refreshing a quiz attempt extends its end time.',
        kind: 'TRUE_FALSE',
        options: { true: 'True', false: 'False' },
        correctKey: 'false',
        explanation: 'The service stores a fixed endAt from the original start time.',
        points: 6,
        version: 1,
      },
    )
    const id = nextId(s.quizzes),
      start = now()
    s.quizzes.push({
      id,
      offeringId,
      title: 'Learning workflow quiz',
      status: 'DRAFT',
      openAt: new Date(start - 60000).toISOString(),
      closeAt: new Date(start + 10 * 60000).toISOString(),
      durationMinutes: 5,
      maxScore: 10,
      questionCount: 2,
      version: 1,
    })
    s.quizEngine.details[id] = {
      topicId: topic,
      mandatory: true,
      selections: [
        { questionItemId: questionId, points: 4 },
        { questionItemId: questionId + 1, points: 6 },
      ],
      published: null,
    }
    s.assessment.quizWeights[id] = 100
    s.assessment.weightVersions[offeringId] = 1
    s.quizEngine.fixtureOfferingId = offeringId
    requireAcademic(offeringId)
    return offeringId
  })
}
