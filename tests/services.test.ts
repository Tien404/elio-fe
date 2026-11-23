import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { utcInput, vietnamDayBoundary, vietnamInput } from '../src/services/assessment-time.ts'
import type { MeView } from '../src/services/contracts.ts'
import { canAccess, pages } from '../src/services/navigation.ts'
import { sumQuizPoints } from '../src/services/quiz-points.ts'

test('assignment deadline crosses midnight in Vietnam and saves the same instant', () => {
  const deadline = '2026-11-09T18:00:00.000Z'
  assert.equal(vietnamInput(deadline), '2026-11-10T01:00')
  assert.equal(utcInput('2026-11-10T01:00'), deadline)
})

test('an empty deadline field stays empty', () => {
  assert.equal(utcInput(''), '')
})

test('calendar range includes the last Vietnam day and rolls over at local midnight', () => {
  const from = vietnamDayBoundary('2026-11-30')
  const to = vietnamDayBoundary('2026-11-30', true)
  assert.equal(new Date(from!).toISOString(), '2026-11-29T17:00:00.000Z')
  assert.equal(new Date(to!).toISOString(), '2026-11-30T17:00:00.000Z')
  assert.equal(vietnamDayBoundary('2026-11-31'), null)
})

test('creating a course section requires an instructor with permission', () => {
  const page = pages.find(({ path }) => path === '/offerings/new')
  assert.ok(page)
  const instructor: MeView = {
    account: {
      id: 1,
      displayName: 'Test instructor',
      role: 'INSTRUCTOR',
      status: 'ACTIVE',
      mustChangePassword: false,
    },
    email: 'teacher@elio.test',
    canCreateCourse: false,
    version: 1,
  }
  assert.equal(canAccess(page, instructor), false)
  assert.equal(canAccess(page, { ...instructor, canCreateCourse: true }), true)
  assert.equal(
    canAccess(page, {
      ...instructor,
      account: { ...instructor.account, role: 'STUDENT' },
      canCreateCourse: true,
    }),
    false,
  )
})

test('quiz scores add fractional question points without a floating-point tail', () => {
  assert.equal(sumQuizPoints([0.1, 0.2, 0.5]), 0.8)
})

test('quiz autosave serializes versions and waits before sealing', async (context) => {
  const { AnswerQueue } = await import('../src/services/answer-queue.ts')
  const { attempt } = quizAttemptFixture(context)
  let view = attempt({})
  const calls: string[] = []
  let releaseFirst!: () => void
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve
  })
  const queue = new AnswerQueue(
    {
      attempt: async () => view,
      saveAnswer: async (_id, question, key, version) => {
        calls.push(`save:${question}:${key}:${version}`)
        if (calls.length === 1) await first
        assert.equal(version, view.attempt.version)
        view = attempt({ ...view.attempt.answers, [question]: key }, version + 1)
        return view
      },
      seal: async (_id, version) => {
        calls.push(`seal:${version}`)
        assert.equal(version, view.attempt.version)
        return { ...view, canAnswer: false, attempt: { ...view.attempt, status: 'SEALED' } }
      },
    },
    view,
    3,
  )
  queue.edit(10, 'A')
  queue.enqueue(10)
  queue.edit(10, 'B')
  queue.enqueue(10)
  queue.edit(10, 'A')
  queue.enqueue(10)
  queue.edit(20, 'B')
  queue.enqueue(20)
  const sealed = queue.seal()
  await Promise.resolve()
  assert.deepEqual(calls, ['save:10:A:1'])
  releaseFirst()
  assert.deepEqual((await sealed).attempt.answers, { 10: 'A', 20: 'B' })
  assert.deepEqual(calls, ['save:10:A:1', 'save:10:B:2', 'save:10:A:3', 'save:20:B:4', 'seal:5'])
  assert.deepEqual(queue.getSnapshot().local, {})
})

test('quiz stale saves preserve local choices until the saved attempt is reviewed', async (context) => {
  const { AnswerQueue } = await import('../src/services/answer-queue.ts')
  const { attempt } = quizAttemptFixture(context)
  let view = attempt({ 10: 'A' })
  const service = {
    attempt: async () => view,
    saveAnswer: async (_id: number, question: number, key: string, version: number) => {
      if (version !== view.attempt.version) throw new Error('VERSION_CONFLICT')
      view = attempt({ ...view.attempt.answers, [question]: key }, version + 1)
      return view
    },
    seal: async () => view,
  }
  const queue = new AnswerQueue(service, view, 4)
  view = attempt({ 10: 'A', 20: 'A' }, 2)
  queue.edit(10, 'B')
  queue.enqueue(10)
  await assert.rejects(queue.seal(), /unresolved/)
  assert.deepEqual(queue.getSnapshot().local, { 10: 'B' })
  const reloaded = new AnswerQueue(service, view, 4)
  assert.equal(reloaded.getSnapshot().paused, true)
  await reloaded.check()
  reloaded.adopt(true)
  reloaded.enqueue(10)
  await reloaded.seal()
  assert.deepEqual(view.attempt.answers, { 10: 'B', 20: 'A' })
})

function quizAttemptFixture(context: TestContext) {
  const data = new Map<string, string>()
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, json: string) => data.set(key, json),
    },
  })
  context.after(() => {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  })
  const time = '2026-11-17T09:00:00Z'
  return {
    attempt(
      answers: Record<string, string>,
      version = 1,
    ): import('../src/services/quiz-contracts.ts').AttemptView {
      return {
        attempt: {
          id: 1,
          quizId: 2,
          status: 'IN_PROGRESS',
          startedAt: time,
          endAt: '2026-11-17T09:20:00Z',
          sealedAt: null,
          questions: [10, 20].map((id, ordinal) => ({
            id,
            ordinal,
            prompt: 'Choose',
            kind: 'SINGLE_CHOICE',
            options: { A: 'A', B: 'B' },
          })),
          answers,
          version,
        },
        canAnswer: true,
        teacher: false,
        serverNow: time,
        finalization: 'PENDING',
        savedAt: {},
        result: { attemptId: 1, state: 'PROCESSING', maxScore: 4, releasedAt: null, breakdown: [] },
        student: { id: 3, displayName: 'Student' },
        quizTitle: 'Quiz',
        offeringId: 1,
        closeAt: '2026-11-17T09:30:00Z',
        durationMinutes: 20,
      }
    },
  }
}

test('numeric question options round-trip without changing their order or correct answer', async () => {
  const { questionBody, questionView } = await import('../src/api/question-dto.ts')
  const question = questionView({
    id: 4,
    offeringId: 1,
    version: 2,
    type: 'SINGLE_CHOICE',
    text: 'Select',
    options: ['Two', 'Three'],
    correctOption: 2,
    correctAnswer: null,
    explanation: null,
    points: 1.25,
  })
  assert.deepEqual(question.options, { '1': 'Two', '2': 'Three' })
  assert.equal(question.correctKey, '2')
  assert.deepEqual(questionBody(question), {
    type: 'SINGLE_CHOICE',
    text: 'Select',
    options: ['Two', 'Three'],
    correctOption: 2,
    correctAnswer: null,
    explanation: null,
    points: 1.25,
  })
})

test('false is option two, not a missing correct answer', async () => {
  const { questionBody, questionView } = await import('../src/api/question-dto.ts')
  const question = questionView({
    id: 4,
    offeringId: 1,
    version: 1,
    type: 'TRUE_FALSE',
    text: 'False statement',
    options: null,
    correctOption: null,
    correctAnswer: false,
    explanation: null,
    points: 2,
  })
  assert.equal(question.correctKey, '2')
  assert.deepEqual(question.options, { '1': 'True', '2': 'False' })
  assert.equal(questionBody(question).correctAnswer, false)
})
