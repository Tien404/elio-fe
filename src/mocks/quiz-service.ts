import { sumQuizPoints } from '@/services/quiz-points'
import type {
  QuizService,
  QuizView,
  QuizInput,
  QuestionItem,
  QuestionInput,
  CopiedQuestion,
  AttemptView,
} from '@/services/quiz-contracts'
import type { Quiz } from '@/services/contracts'
import type { StoredAttempt } from './quiz-state'
import { ServiceError } from '@/services/errors'
import {
  requireAcademic,
  text,
  nextId,
  version,
  page,
  matches,
  account,
  audit,
  notify,
} from './policy'
import { current } from './services'
import { request } from './scenarios'
import { getStore, commit, now } from './store'
import { resultFor } from './quiz-runtime'
let lostStart = false,
  lostSave = false
export function loseQuizResponse(kind: 'start' | 'save') {
  if (kind === 'start') lostStart = true
  else lostSave = true
}
export function clearQuizResponseFaults() {
  lostStart = false
  lostSave = false
}
function quizAccess(id: number, write = false) {
  const s = getStore(),
    q = s.quizzes.find((q) => q.id === id)
  if (!q) throw new ServiceError(404, 'Quiz not found.')
  const ctx = requireAcademic(q.offeringId, write)
  if (!ctx.teacher && q.status === 'DRAFT') throw new ServiceError(404, 'Quiz is not published.')
  return { ...ctx, q }
}
function questionAccess(id: number, write = false) {
  const q = getStore().quizEngine.bank.find((q) => q.id === id)
  if (!q) throw new ServiceError(404, 'Question not found.')
  const ctx = requireAcademic(q.offeringId, write)
  if (!ctx.teacher) throw new ServiceError(403, 'Question bank requires current teaching access.')
  return { ...ctx, q }
}
function validateQuestion(i: QuestionInput) {
  text(i.prompt, 'Question content', 5000)
  const keys = Object.keys(i.options)
  if (
    !['SINGLE_CHOICE', 'TRUE_FALSE'].includes(i.kind) ||
    keys.length < 2 ||
    keys.length > 20 ||
    keys.some((k) => !k.trim() || k.length > 50 || !i.options[k].trim()) ||
    !keys.includes(i.correctKey) ||
    !Number.isFinite(i.points) ||
    i.points <= 0
  )
    throw new ServiceError(
      422,
      'Provide 2–20 non-empty options, one valid answer key and positive points.',
    )
  if (
    i.kind === 'TRUE_FALSE' &&
    (keys.length !== 2 || !keys.includes('true') || !keys.includes('false'))
  )
    throw new ServiceError(422, 'True/False questions require exactly the true and false options.')
}
function selections(i: QuizInput, offeringId: number) {
  if (
    !i.questions.length ||
    new Set(i.questions.map((q) => q.questionItemId)).size !== i.questions.length
  )
    throw new ServiceError(422, 'Select at least one question, without duplicates.')
  return i.questions.map((sel) => {
    const q = getStore().quizEngine.bank.find(
      (q) => q.id === sel.questionItemId && q.offeringId === offeringId,
    )
    if (!q || !Number.isFinite(sel.points) || sel.points <= 0)
      throw new ServiceError(
        422,
        'Select questions from this section and give each positive points.',
      )
    validateQuestion(q)
    return { q, points: sel.points }
  })
}
function validateQuiz(i: QuizInput, offeringId: number) {
  text(i.title, 'Title', 200)
  const start = Date.parse(i.openAt),
    end = Date.parse(i.closeAt)
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    !Number.isSafeInteger(i.durationMinutes) ||
    i.durationMinutes < 1 ||
    i.durationMinutes * 60000 > end - start
  )
    throw new ServiceError(
      422,
      'Open time must precede close time. Duration must be a positive whole number of minutes within the availability window.',
    )
  if (!Number.isFinite(i.weight) || i.weight < 0 || i.weight > 100)
    throw new ServiceError(422, 'Weight must be between 0 and 100.')
  if (
    i.topicId !== null &&
    !getStore().workspace.topics.some((t) => t.id === i.topicId && t.offeringId === offeringId)
  )
    throw new ServiceError(422, 'Topic must belong to the same section.')
  const selected = selections(i, offeringId)
  if (!Number.isFinite(sumQuizPoints(selected.map((x) => x.points))))
    throw new ServiceError(422, 'The total question points must be finite.')
  return selected
}
export function quizView(q: Quiz): QuizView {
  const ctx = requireAcademic(q.offeringId),
    s = getStore(),
    m = s.quizEngine.details[q.id],
    own = s.quizEngine.attempts.find((a) => a.quizId === q.id && a.studentId === ctx.me.account.id)
  const teacher = ctx.teacher,
    published = !!m?.published
  return {
    quiz: q,
    offeringLabel: `${ctx.offering.courseCode} · ${ctx.offering.sectionCode} · ${ctx.offering.semester}`,
    teacher,
    writable: ctx.permissions.teach && q.status !== 'ARCHIVED',
    canStart:
      !teacher &&
      q.status === 'PUBLISHED' &&
      published &&
      ctx.offering.status === 'OPEN' &&
      now() >= Date.parse(q.openAt) &&
      now() < Date.parse(q.closeAt) &&
      !own,
    scheduleLocked: s.quizEngine.attempts.some((a) => a.quizId === q.id),
    serverNow: new Date(now()).toISOString(),
    topicId: m?.topicId ?? null,
    mandatory: m?.mandatory ?? true,
    weight: s.assessment.quizWeights[q.id] ?? 0,
    attemptId: teacher ? null : (own?.id ?? null),
    attemptCount: teacher
      ? s.quizEngine.attempts.filter((a) => a.quizId === q.id).length
      : own
        ? 1
        : 0,
    topics: s.workspace.topics.filter((t) => t.offeringId === q.offeringId),
    ...(teacher
      ? {
          teacherContent: {
            selections: m?.selections ?? [],
            published,
            questions:
              m?.published ??
              (m?.selections ?? []).flatMap((sel, index) => {
                const question = s.quizEngine.bank.find((b) => b.id === sel.questionItemId)
                return question
                  ? [
                      {
                        ...question,
                        id: question.id,
                        questionItemId: question.id,
                        sourceVersion: question.version,
                        ordinal: index + 1,
                        points: sel.points,
                      },
                    ]
                  : []
              }),
          },
        }
      : {}),
  }
}
function attemptAccess(id: number) {
  const a = getStore().quizEngine.attempts.find((a) => a.id === id)
  if (!a) throw new ServiceError(404, 'Attempt not found.')
  const ctx = quizAccess(a.quizId)
  if (!ctx.teacher && (ctx.me.account.role !== 'STUDENT' || ctx.me.account.id !== a.studentId))
    throw new ServiceError(403, 'Only the current owner or teaching team can view this attempt.')
  return { ...ctx, a }
}
export function attemptView(a: StoredAttempt): AttemptView {
  const { q, teacher, offering, me } = attemptAccess(a.id),
    questions = getStore().quizEngine.details[q.id]?.published ?? [],
    student = account(a.studentId)
  return {
    attempt: {
      id: a.id,
      quizId: a.quizId,
      status: a.status,
      startedAt: a.startedAt,
      endAt: a.endAt,
      sealedAt: a.sealedAt,
      questions: questions.map((c) => ({
        id: c.id,
        ordinal: c.ordinal,
        prompt: c.prompt,
        kind: c.kind,
        options: { ...c.options },
      })),
      answers: { ...a.answers },
      version: a.version,
    },
    serverNow: new Date(now()).toISOString(),
    canAnswer:
      !teacher &&
      me.account.id === a.studentId &&
      a.status === 'IN_PROGRESS' &&
      offering.status === 'OPEN' &&
      q.status === 'PUBLISHED' &&
      now() < Date.parse(a.endAt),
    teacher,
    finalization: a.finalization,
    result: resultFor(a),
    savedAt: { ...a.savedAt },
    student: { id: student.id, displayName: student.displayName },
    quizTitle: q.title,
    offeringId: q.offeringId,
    closeAt: q.closeAt,
    durationMinutes: q.durationMinutes,
  }
}
export const mockQuiz: QuizService = {
  bank: (offeringId, query = {}) =>
    request((p) => {
      const ctx = requireAcademic(offeringId)
      if (!ctx.teacher) throw new ServiceError(403, 'Question bank requires teaching access.')
      return page(
        ctx.store.quizEngine.bank
          .filter(
            (q) =>
              q.offeringId === offeringId &&
              matches(query.search, q.prompt) &&
              (!query.kind || q.kind === query.kind),
          )
          .sort((a, b) => a.id - b.id),
        query,
        p === 'empty',
      )
    }),
  question: (id) => request(() => questionAccess(id).q),
  saveQuestion: (offeringId, id, input, expectedVersion) =>
    request(() =>
      commit(() => {
        requireAcademic(offeringId, true)
        const s = getStore(),
          old = id ? questionAccess(id, true).q : null
        if (old && old.offeringId !== offeringId)
          throw new ServiceError(404, 'Question not found in this section.')
        if (old) version(old.version, expectedVersion)
        validateQuestion(input)
        const q: QuestionItem = {
          ...input,
          prompt: input.prompt.trim(),
          options: { ...input.options },
          id: old?.id ?? nextId(s.quizEngine.bank),
          offeringId,
          version: (old?.version ?? 0) + 1,
        }
        if (old) Object.assign(old, q)
        else s.quizEngine.bank.push(q)
        audit(offeringId, 'QUESTION_SAVED', q.id, 'Question bank content updated.', 'QUESTION_ITEM')
        return q
      }),
    ),
  list: (query = {}) =>
    request((p) => {
      const { me } = current()
      if (me.account.role === 'ADMIN')
        throw new ServiceError(403, 'Operational access does not include quizzes.')
      if (query.offeringId) requireAcademic(query.offeringId)
      const s = getStore(),
        ids = s.memberships
          .filter((m) => m.account.id === me.account.id && m.status === 'ACTIVE')
          .map((m) => m.offeringId),
        rows = s.quizzes
          .filter(
            (q) =>
              ids.includes(q.offeringId) &&
              (!query.offeringId || q.offeringId === query.offeringId) &&
              (!query.status || q.status === query.status) &&
              matches(query.search, q.title) &&
              (me.account.role === 'INSTRUCTOR' ||
                (q.status === 'PUBLISHED' &&
                  s.offerings.find((o) => o.id === q.offeringId)?.status !== 'DRAFT')),
          )
          .sort((a, b) => a.id - b.id),
        result = page(rows, query, p === 'empty')
      return { ...result, items: result.items.map(quizView) }
    }),
  get: (id) => request(() => quizView(quizAccess(id).q)),
  save: (offeringId, id, input, expectedVersion) =>
    request(() =>
      commit(() => {
        requireAcademic(offeringId, true)
        const s = getStore(),
          old = id ? quizAccess(id, true).q : null
        if (old && old.offeringId !== offeringId)
          throw new ServiceError(404, 'Quiz not found in this section.')
        if (old) version(old.version, expectedVersion)
        if (old?.status === 'ARCHIVED')
          throw new ServiceError(409, 'Archived quizzes are read-only.')
        const selected = validateQuiz(input, offeringId),
          m = old ? s.quizEngine.details[old.id] : null
        if (old && m?.published) {
          if (
            input.title !== old.title ||
            input.topicId !== m.topicId ||
            input.mandatory !== m.mandatory ||
            JSON.stringify(input.questions) !== JSON.stringify(m.selections) ||
            input.weight !== (s.assessment.quizWeights[old.id] ?? 0)
          )
            throw new ServiceError(
              409,
              'Published content is immutable. Edit only timing before the first attempt; use gradebook for weights.',
            )
          if (
            s.quizEngine.attempts.some((a) => a.quizId === old.id) &&
            (input.openAt !== old.openAt ||
              input.closeAt !== old.closeAt ||
              input.durationMinutes !== old.durationMinutes)
          )
            throw new ServiceError(409, 'Schedule and duration are locked from the first attempt.')
        }
        const q: Quiz = {
          id: old?.id ?? nextId(s.quizzes),
          offeringId,
          title: input.title.trim(),
          status: old?.status ?? 'DRAFT',
          openAt: new Date(input.openAt).toISOString(),
          closeAt: new Date(input.closeAt).toISOString(),
          durationMinutes: input.durationMinutes,
          maxScore:
            old && m?.published ? old.maxScore : sumQuizPoints(selected.map((x) => x.points)),
          questionCount: selected.length,
          version: (old?.version ?? 0) + 1,
        }
        if (old) Object.assign(old, q)
        else s.quizzes.push(q)
        s.quizEngine.details[q.id] = {
          topicId: input.topicId,
          mandatory: input.mandatory,
          selections: input.questions.map((sel) => ({ ...sel })),
          published: m?.published ?? null,
        }
        s.assessment.quizWeights[q.id] = input.weight
        s.assessment.weightVersions[offeringId] = (s.assessment.weightVersions[offeringId] ?? 1) + 1
        return quizView(old ?? q)
      }),
    ),
  publish: (id, expectedVersion) =>
    request(() =>
      commit(() => {
        const { q, store: s } = quizAccess(id, true)
        version(q.version, expectedVersion)
        if (q.status !== 'DRAFT') throw new ServiceError(409, 'Only a draft quiz can be published.')
        const m = s.quizEngine.details[id],
          input: QuizInput = {
            ...q,
            topicId: m.topicId,
            mandatory: m.mandatory,
            weight: s.assessment.quizWeights[id] ?? 0,
            questions: m.selections,
          },
          selected = validateQuiz(input, q.offeringId),
          start = nextId(Object.values(s.quizEngine.details).flatMap((m) => m.published ?? []))
        m.published = selected.map(
          (x, i) =>
            ({
              id: start + i,
              ordinal: i + 1,
              questionItemId: x.q.id,
              sourceVersion: x.q.version,
              prompt: x.q.prompt,
              kind: x.q.kind,
              options: { ...x.q.options },
              correctKey: x.q.correctKey,
              explanation: x.q.explanation,
              points: x.points,
            }) satisfies CopiedQuestion,
        )
        q.maxScore = sumQuizPoints(m.published.map((c) => c.points))
        q.questionCount = m.published.length
        q.status = 'PUBLISHED'
        q.version++
        notify(q.offeringId, 'A quiz was published.', `/quizzes/${id}`)
        return quizView(q)
      }),
    ),
  archive: (id, expectedVersion) =>
    request(() =>
      commit(() => {
        const { q, store: s } = quizAccess(id, true)
        version(q.version, expectedVersion)
        if (q.status === 'ARCHIVED') throw new ServiceError(409, 'Quiz is already archived.')
        if (s.quizEngine.attempts.some((a) => a.quizId === id && a.finalization !== 'SUCCEEDED'))
          throw new ServiceError(
            409,
            'Active or unresolved attempts must finalize successfully before quiz archive.',
          )
        q.status = 'ARCHIVED'
        q.version++
        return quizView(q)
      }),
    ),
  start: (id) =>
    request(() => {
      const { q, me, offering, teacher, store: s } = quizAccess(id)
      if (teacher || me.account.role !== 'STUDENT')
        throw new ServiceError(403, 'Only an eligible student can start a quiz.')
      if (s.quizEngine.attempts.some((a) => a.quizId === id && a.studentId === me.account.id))
        throw new ServiceError(
          409,
          'An attempt already exists. Check existing attempt and resume; the timer is unchanged.',
        )
      if (
        q.status !== 'PUBLISHED' ||
        offering.status !== 'OPEN' ||
        now() < Date.parse(q.openAt) ||
        now() >= Date.parse(q.closeAt)
      )
        throw new ServiceError(
          409,
          'Start requires an Open section and open time ≤ service time < quiz close.',
        )
      if (!s.quizEngine.details[id]?.published?.length)
        throw new ServiceError(409, 'The published question snapshot is unavailable.')
      const value = commit(() => {
        const start = now(),
          a: StoredAttempt = {
            id: nextId(s.quizEngine.attempts),
            quizId: id,
            studentId: me.account.id,
            status: 'IN_PROGRESS',
            startedAt: new Date(start).toISOString(),
            endAt: new Date(
              Math.min(Date.parse(q.closeAt), start + q.durationMinutes * 60000),
            ).toISOString(),
            sealedAt: null,
            answers: {},
            version: 1,
            finalization: 'PENDING',
            readyAt: null,
            savedAt: {},
            finalizedAt: null,
            releasedAt: null,
            score: null,
          }
        s.quizEngine.attempts.push(a)
        return attemptView(a)
      })
      if (lostStart) {
        lostStart = false
        throw new ServiceError(
          0,
          'Start response was lost. Check existing attempt. Do not start another attempt.',
        )
      }
      return value
    }),
  own: (id) =>
    request(() => {
      const { store: s, me, teacher } = quizAccess(id)
      if (teacher || me.account.role !== 'STUDENT')
        throw new ServiceError(403, 'Own attempt recovery is student-only.')
      const a = s.quizEngine.attempts.find((a) => a.quizId === id && a.studentId === me.account.id)
      return a ? attemptView(a) : null
    }),
  attempt: (id) => request(() => attemptView(attemptAccess(id).a)),
  saveAnswer: (id, questionId, key, expectedVersion) =>
    request(() => {
      const { a, q, teacher, offering, me } = attemptAccess(id)
      if (
        teacher ||
        me.account.id !== a.studentId ||
        offering.status !== 'OPEN' ||
        q.status !== 'PUBLISHED'
      )
        throw new ServiceError(403, 'Current owner access in an Open section is required to save.')
      if (a.status !== 'IN_PROGRESS' || now() >= Date.parse(a.endAt))
        throw new ServiceError(
          409,
          'Answer saving is closed. Only answers already saved in the service will be finalized.',
        )
      version(a.version, expectedVersion)
      const question = getStore().quizEngine.details[q.id].published?.find(
        (c) => c.id === questionId,
      )
      if (!question || !Object.hasOwn(question.options, key))
        throw new ServiceError(422, 'Choose a valid copied option for this attempt question.')
      const value = commit(() => {
        a.answers[String(questionId)] = key
        a.savedAt[String(questionId)] = new Date(now()).toISOString()
        a.version++
        return attemptView(a)
      })
      if (lostSave) {
        lostSave = false
        throw new ServiceError(
          0,
          'Answer response was lost. Check saved answers and review the durable version before saving again.',
        )
      }
      return value
    }),
  seal: (id, expectedVersion) =>
    request(() => {
      const { a, teacher, offering, me } = attemptAccess(id)
      if (teacher || me.account.id !== a.studentId)
        throw new ServiceError(403, 'Only the current owner can seal this attempt.')
      if (a.status === 'SEALED') return attemptView(a)
      if (offering.status !== 'OPEN')
        throw new ServiceError(403, 'Academic work is read-only in an Archived section.')
      version(a.version, expectedVersion)
      return commit(() => {
        a.status = 'SEALED'
        a.sealedAt = new Date(now()).toISOString()
        a.version++
        a.readyAt = new Date(now() + 1000).toISOString()
        return attemptView(a)
      })
    }),
  attempts: (id, query = {}) =>
    request((p) => {
      const { teacher, store: s } = quizAccess(id)
      if (!teacher)
        throw new ServiceError(403, 'Attempt management requires current teaching access.')
      return page(
        s.quizEngine.attempts
          .filter((a) => a.quizId === id)
          .sort((a, b) => a.id - b.id)
          .map(attemptView),
        query,
        p === 'empty',
      )
    }),
}
