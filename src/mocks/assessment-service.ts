import type { AssessmentService } from '@/services/assessment-contracts'
import { assignmentMethods } from './assignment-service'
import { submissionMethods } from './submission-service'
import { gradingMethods } from './grading-service'
export const mockAssessment: AssessmentService = {
  ...assignmentMethods,
  ...submissionMethods,
  ...gradingMethods,
}
