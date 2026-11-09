import { apiIdentity } from '@/api/identity'
import { apiCourses } from '@/api/courses'
import { apiContent, apiFiles } from '@/api/content'
import { apiAssessment } from '@/api/assessment'
export { getDashboard as getMvpDashboard } from '@/api/dashboard'
export { getMvpSubmissions, getMvpSubmissionHistory } from '@/api/assessment'
import { prepareInboxScenarios } from '@/mocks/personal-scenarios'
import { mockPersonal, type PersonalService } from '@/mocks/personal-service'
import { mockAdmin, type AdminService } from '@/mocks/admin-service'
import {
  prepareQuizScenarios,
  setQuizWorkerMode,
  runQuizWorker,
  retryFailedQuizFinalizations,
} from '@/mocks/quiz-scenarios'
import type { QuizService } from '@/services/quiz-contracts'
import { mockQuiz, loseQuizResponse, clearQuizResponseFaults } from '@/mocks/quiz-service'
import { prepareAssessmentScenarios } from '@/mocks/assessment-scenarios'
import type { AssessmentService } from '@/services/assessment-contracts'
import { mockAssessment } from '@/mocks/assessment-service'
import { loseNextConfirmResponse } from '@/mocks/submission-service'
import { prepareCourseScenarios, finalizeExpiredDemoAttempts } from '@/mocks/course-scenarios'
import type { CourseService, ContentService } from '@/services/course-contracts'
import { mockCourses } from '@/mocks/course-service'
import { mockContent } from '@/mocks/content-service'
import type { IdentityService, WorkspaceService, FileService } from '@/services/contracts'
import { ServiceError } from '@/services/errors'
import { mockIdentity, mockWorkspace, mockFiles } from '@/mocks/services'
import { advanceClock, resetStore, now, STORE_KEY, reloadStore } from '@/mocks/store'
import { scenarios } from '@/mocks/scenarios'

const source = import.meta.env.VITE_DATA_SOURCE || 'api'
export const apiMode = source === 'api'
if (source !== 'mock' && source !== 'api') throw new Error('VITE_DATA_SOURCE must be mock or api.')
const unavailable = async (): Promise<never> => {
  throw new ServiceError(501, 'This feature is unavailable.')
}
const apiWorkspace: WorkspaceService = {
  listOfferings: async () =>
    (await apiCourses.list({ pageSize: 100 })).items.map((v) => v.offering),
  downloadDemoAsset: unavailable,
}
export const services: {
  personal: PersonalService
  admin: AdminService
  quiz: QuizService
  assessment: AssessmentService
  identity: IdentityService
  workspace: WorkspaceService
  files: FileService
  courses: CourseService
  content: ContentService
} =
  source === 'mock'
    ? {
        personal: mockPersonal,
        admin: mockAdmin,
        quiz: mockQuiz,
        assessment: mockAssessment,
        identity: mockIdentity,
        workspace: mockWorkspace,
        files: mockFiles,
        courses: mockCourses,
        content: mockContent,
      }
    : {
        personal: {
          summary: unavailable,
          dashboard: unavailable,
          inbox: unavailable,
          read: unavailable,
          destination: unavailable,
          calendar: unavailable,
          progress: unavailable,
        },
        admin: {
          accounts: unavailable,
          provision: unavailable,
          update: unavailable,
          resetPassword: unavailable,
          audit: unavailable,
        },
        quiz: {
          bank: unavailable,
          question: unavailable,
          saveQuestion: unavailable,
          list: unavailable,
          get: unavailable,
          save: unavailable,
          publish: unavailable,
          archive: unavailable,
          start: unavailable,
          own: unavailable,
          attempt: unavailable,
          saveAnswer: unavailable,
          seal: unavailable,
          attempts: unavailable,
        },
        assessment: apiAssessment,
        courses: apiCourses,
        content: apiContent,
        identity: apiIdentity,
        workspace: apiWorkspace,
        files: apiFiles,
      }
export const demo =
  source === 'mock'
    ? {
        prepareInboxScenarios,
        prepareQuizScenarios,
        setQuizWorkerMode,
        runQuizWorker,
        retryFailedQuizFinalizations,
        loseQuizResponse,
        prepareAssessmentScenarios,
        loseNextConfirmResponse,
        scenarios,
        prepareCourseScenarios,
        finalizeExpiredDemoAttempts,
        advanceClock,
        reset() {
          clearQuizResponseFaults()
          scenarios.reset()
          resetStore()
        },
      }
    : null

export const sessionLifecycle = {
  remainingMs(expiresAt: string) {
    return Date.parse(expiresAt) - (source === 'mock' ? now() : Date.now())
  },
  subscribe(onChange: () => void, onExpired: () => void) {
    const sync = (event: StorageEvent) => {
      if (event.key === STORE_KEY) {
        reloadStore()
        onChange()
      }
    }
    if (source === 'mock') {
      window.addEventListener('storage', sync)
      window.addEventListener('elio:session', onChange)
    }
    window.addEventListener('elio:expired', onExpired)
    return () => {
      if (source === 'mock') {
        window.removeEventListener('storage', sync)
        window.removeEventListener('elio:session', onChange)
      }
      window.removeEventListener('elio:expired', onExpired)
    }
  },
}
