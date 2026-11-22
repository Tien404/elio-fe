import { changeGroupMembership, releaseAssignmentGrades } from './group-membership'
import type { AssessmentService } from '@/services/assessment-contracts'
import { assignmentMethods } from './assignment-service'
import { submissionMethods } from './submission-service'
import { gradingMethods } from './grading-service'
export const mockAssessment: AssessmentService = {
  joinGroup: (id) => changeGroupMembership(id, true),
  leaveGroup: (id) => changeGroupMembership(id, false),
  releaseGrades: releaseAssignmentGrades,
  ...assignmentMethods,
  ...submissionMethods,
  ...gradingMethods,
}
