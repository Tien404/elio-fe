import { sumQuizPoints } from '@/services/quiz-points'
import type { QuizInput, QuizQuery, QuizService, QuizView } from '@/services/quiz-contracts'
import type { OfferingView, Page, PageQuery } from '@/services/course-contracts'
import {
  attemptView,
  questionView,
  questionBody,
  type MainQuiz,
  type MainAttempt,
  type MainQuestion,
  type MainOwnAttempts,
} from './quiz-dto'
import { allPages, apiCourses, localPage, offeringView, pageParams } from './courses'
import { http, json } from './http'

type QuizDto = MainQuiz

async function quizView(dto: QuizDto, section: OfferingView): Promise<QuizView> {
  const teacher = section.permissions.academic && section.teachingRole !== null
  const own = teacher ? null : await http<MainOwnAttempts>(`/quizzes/${dto.id}/attempts/me`)
  const questions = (dto.questions ?? []).map((q) => ({
    ...questionView({ ...q, offeringId: dto.offeringId, version: q.version ?? 1 }),
    questionItemId: q.sourceQuestionId ?? q.id,
    sourceVersion: q.sourceVersion ?? q.version ?? null,
    ordinal: q.position ?? 1,
  }))
  return {
    quiz: {
      id: dto.id,
      offeringId: dto.offeringId,
      title: dto.title,
      status: dto.status,
      openAt: dto.openAt,
      closeAt: dto.closeAt,
      durationMinutes: dto.durationMinutes,
      maxScore: dto.totalPoints,
      questionCount: dto.questionCount,
      version: dto.version,
    },
    offeringLabel: `${section.offering.courseCode} · ${section.offering.sectionCode}`,
    offeringStatus: section.offering.status,
    teacher,
    writable: section.permissions.teach && dto.status !== 'ARCHIVED',
    canStart: own?.canStart ?? false,
    scheduleLocked: dto.scheduleLocked,
    serverNow: dto.serverNow,
    topicId: dto.topicId,
    mandatory: dto.mandatory,
    weight: dto.weight,
    attemptId: own?.attempts.at(-1)?.id ?? null,
    attemptCount: own?.attemptsUsed ?? 0,
    maxAttempts: dto.maxAttempts,
    gradingMethod: dto.gradingMethod,
    releasePolicy: dto.releasePolicy,
    countedScore: own?.countedScore ?? null,
    ownAttempts:
      own?.attempts.map((a) => ({ id: a.id, attemptNo: a.attemptNo, score: a.score })) ?? [],
    topics: [],
    ...(teacher
      ? {
          teacherContent: {
            selections: questions.map((q) => ({
              questionItemId: q.questionItemId,
              points: q.points,
            })),
            questions,
            published: dto.status !== 'DRAFT',
          },
        }
      : {}),
  }
}

function quizListPath(offeringId: number, query: QuizQuery) {
  const params = new URLSearchParams()
  if (query.search?.trim()) params.set('q', query.search.trim())
  if (query.status) params.set('status', query.status)
  return `/offerings/${offeringId}/quizzes${params.size ? `?${params}` : ''}`
}

async function quizRows(query: QuizQuery) {
  const sections = query.offeringId
    ? [await apiCourses.get(query.offeringId)]
    : await allPages<OfferingView['offering'] & Omit<OfferingView, 'offering'>>('/offerings').then(
        (rows) => rows.map(offeringView),
      )
  const lists = await Promise.all(
    sections
      .filter((section) => section.permissions.academic)
      .map(async (section) => {
        const items = await allPages<QuizDto>(quizListPath(section.offering.id, query))
        return Promise.all(items.map((item) => quizView(item, section)))
      }),
  )
  return lists
    .flat()
    .sort((a, b) => Date.parse(a.quiz.openAt) - Date.parse(b.quiz.openAt) || a.quiz.id - b.quiz.id)
}

async function writeQuiz(path: string, request: RequestInit) {
  const dto = await http<QuizDto>(path, request)
  return quizView(dto, await apiCourses.get(dto.offeringId))
}

function quizBody(input: QuizInput) {
  return {
    ...input,
    totalPoints: sumQuizPoints(input.questions.map((q) => q.points)) || input.totalPoints || 10,
  }
}

export const apiQuiz: QuizService = {
  async bank(offeringId, query = {}) {
    const params = pageParams(query)
    if (query.search?.trim()) params.set('q', query.search.trim())
    if (query.kind) params.set('kind', query.kind)
    const page = await http<Page<MainQuestion>>(
      `/offerings/${offeringId}/question-bank-items?${params}`,
    )
    return { ...page, items: page.items.map(questionView) }
  },
  question: async (id) => questionView(await http<MainQuestion>(`/question-bank-items/${id}`)),
  async saveQuestion(offeringId, id, input, version) {
    return questionView(
      await http<MainQuestion>(
        id ? `/question-bank-items/${id}` : `/offerings/${offeringId}/question-bank-items`,
        json(id ? 'PATCH' : 'POST', questionBody(input), version),
      ),
    )
  },
  async list(query = {}) {
    if (!query.offeringId) return localPage(await quizRows(query), query)
    const base = quizListPath(query.offeringId, query)
    const [section, page] = await Promise.all([
      apiCourses.get(query.offeringId),
      http<Page<QuizDto>>(`${base}${base.includes('?') ? '&' : '?'}${pageParams(query)}`),
    ])
    return { ...page, items: await Promise.all(page.items.map((item) => quizView(item, section))) }
  },
  async get(id) {
    const dto = await http<QuizDto>(`/quizzes/${id}`)
    return quizView(dto, await apiCourses.get(dto.offeringId))
  },
  save(offeringId, id, input, version, scheduleOnly) {
    const { openAt, closeAt, durationMinutes } = input
    return writeQuiz(
      id ? `/quizzes/${id}` : `/offerings/${offeringId}/quizzes`,
      json(
        id ? 'PATCH' : 'POST',
        scheduleOnly ? { openAt, closeAt, durationMinutes } : quizBody(input),
        version,
      ),
    )
  },
  publish: (id, version) =>
    writeQuiz(`/quizzes/${id}/publication`, json('PUT', undefined, version)),
  archive: (id, version) =>
    writeQuiz(`/quizzes/${id}`, json('PATCH', { status: 'ARCHIVED' }, version)),
  start: async (id) =>
    attemptView(await http<MainAttempt>(`/quizzes/${id}/attempts`, { method: 'POST' })),
  async own(id) {
    const own = await http<MainOwnAttempts>(`/quizzes/${id}/attempts/me`)
    const latest = own.attempts.at(-1)
    return latest ? apiQuiz.attempt(latest.id) : null
  },
  attempt: async (id) => attemptView(await http<MainAttempt>(`/quiz-attempts/${id}`)),
  saveAnswer: async (id, questionId, selectedKey, version) =>
    attemptView(
      await http<MainAttempt>(
        `/quiz-attempts/${id}/answers/${questionId}`,
        json('PUT', { option: Number(selectedKey) }, version),
      ),
    ),
  seal: async (id, version) =>
    attemptView(
      await http<MainAttempt>(`/quiz-attempts/${id}/seal`, json('POST', undefined, version)),
    ),
  async attempts(id, query) {
    const page = await http<Page<MainAttempt>>(`/quizzes/${id}/attempts?${pageParams(query)}`)
    return { ...page, items: await Promise.all(page.items.map(attemptView)) }
  },
}

export async function getOwnQuizResults(offeringId: number | undefined, query: PageQuery) {
  const quizzes = (await quizRows({ offeringId })).flatMap((view) =>
    view.attemptId ? [view.attemptId] : [],
  )
  const page = localPage(quizzes, query)
  return { ...page, items: await Promise.all(page.items.map((id) => apiQuiz.attempt(id))) }
}
