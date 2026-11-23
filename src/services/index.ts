import { apiQuiz } from '@/api/quiz'
export { getOwnQuizResults } from '@/api/quiz'
import { apiIdentity } from '@/api/identity'
import { apiAdmin } from '@/api/administration'
import { apiCourses } from '@/api/courses'
import { apiContent, apiFiles } from '@/api/content'
import { apiAssessment } from '@/api/assessment'
export {
  getMvpSubmissions,
  getMvpSubmissionHistory,
  getPublishedAssignmentResults,
} from '@/api/assessment'
import { prepareInboxScenarios } from '@/mocks/personal-scenarios'
import { apiPersonal } from '@/api/personal'
import { mockPersonal } from '@/mocks/personal-service'
import type { PersonalService } from '@/services/personal-contracts'
import { mockAdmin } from '@/mocks/admin-service'
import type { AdminService } from '@/services/admin-contracts'
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
        personal: apiPersonal,
        admin: apiAdmin,
        quiz: apiQuiz,
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
