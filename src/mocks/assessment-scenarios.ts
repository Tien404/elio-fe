import { current } from './services'
import { commit, getStore, now } from './store'
import { account, nextId } from './policy'
import { ServiceError } from '@/services/errors'
export function prepareAssessmentScenarios() {
  const me = current().me
  if (me.account.role !== 'INSTRUCTOR')
    throw new ServiceError(
      403,
      'Sign in as a demo instructor to prepare assignment review fixtures.',
    )
  return commit(() => {
    const s = getStore(),
      old = s.assessment.fixtureOfferingId
    if (old && s.offerings.some((o) => o.id === old)) return old
    const offeringId = nextId(s.offerings),
      leadId = nextId(s.memberships),
      courseId = s.workspace.catalog[0].id
    s.offerings.push({
      id: offeringId,
      courseId,
      courseCode: s.workspace.catalog[0].courseCode,
      title: 'Assignment Studio',
      semester: 'DEMO',
      sectionCode: `FE02-${offeringId}`,
      status: 'OPEN',
      leadMembershipId: leadId,
      version: 1,
    })
    const people = [me.account.id, ...[2, 3, 1, 6, 7, 8, 5].filter((id) => id !== me.account.id)]
    people.forEach((id, i) =>
      s.memberships.push({
        id: leadId + i,
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
    const code = offeringId.toString(36).toUpperCase().padStart(6, 'F')
    s.workspace.details[offeringId] = {
      learningInformation:
        'Review individual and shared group submissions, receipts and published grades.',
      joinCode: code,
      joinEnabled: true,
    }
    s.workspace.usedCodes.push(code)
    const topicId = nextId(s.workspace.topics)
    s.workspace.topics.push({
      id: topicId,
      offeringId,
      title: 'Assessment studio',
      position: 1,
      version: 1,
    })
    const id = nextId(s.assignments),
      start = now()
    for (let i = 0; i < 2; i++) {
      s.assignments.push({
        id: id + i,
        offeringId,
        title: i ? 'Shared design project' : 'Individual analysis',
        instructions: 'Use a fake demo file. Upload, review and explicitly confirm your work.',
        mode: i ? 'GROUP' : 'INDIVIDUAL',
        status: 'PUBLISHED',
        openAt: new Date(start - 3600000).toISOString(),
        dueAt: new Date(start + 1800000).toISOString(),
        cutoffAt: new Date(start + 3600000).toISOString(),
        maxScore: 10,
        weight: i ? 60 : 40,
        version: 1,
      })
      s.assessment.meta[id + i] = { topicId, fileIds: [], mandatory: true, everPublished: true }
    }
    const groupId = nextId(s.groups)
    s.groups.push(
      {
        id: groupId,
        assignmentId: id + 1,
        name: 'Design team',
        memberStudentIds: [1, 6, 8],
        lockedAt: null,
        version: 1,
      },
      {
        id: groupId + 1,
        assignmentId: id + 1,
        name: 'Research team',
        memberStudentIds: [7],
        lockedAt: null,
        version: 1,
      },
    )
    s.assessment.fixtureOfferingId = offeringId
    for (const studentId of [1, 8])
      if (!s.assessment.quizResults.some((r) => r.quizId === 901 && r.studentId === studentId))
        s.assessment.quizResults.push({
          quizId: 901,
          studentId,
          state: studentId === 1 ? 'GRADING_ERROR' : 'AWAITING_PUBLICATION',
          score: null,
          feedback: null,
        })
    return offeringId
  })
}
