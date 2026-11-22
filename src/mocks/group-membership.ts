import { commit } from './store'
import { assignmentAccess } from './assignment-service'
import { ServiceError } from '@/services/errors'
import { request } from './scenarios'
import { getStore } from './store'

export async function changeGroupMembership(id: number, join: boolean): Promise<void> {
  await request(() =>
    commit(() => {
      const store = getStore(),
        group = store.groups.find((g) => g.id === id)
      if (!group) throw new ServiceError(404, 'Group not found.')
      const { a, teacher, me, offering } = assignmentAccess(group.assignmentId)
      if (
        teacher ||
        a.groupFormation === 'INSTRUCTOR' ||
        offering.status !== 'OPEN' ||
        a.status !== 'PUBLISHED'
      )
        throw new ServiceError(403, 'Students cannot change these groups.')
      if (group.lockedAt)
        throw new ServiceError(409, 'Members are fixed after submission or grading.')
      const mine = store.groups.find(
        (g) => g.assignmentId === a.id && g.memberStudentIds.includes(me.account.id),
      )
      if (join) {
        if (mine) throw new ServiceError(409, 'Leave your current group first.')
        if (group.memberStudentIds.length >= (a.maxGroupSize ?? 20))
          throw new ServiceError(409, 'This group is full.')
        group.memberStudentIds.push(me.account.id)
      } else {
        if (mine?.id !== id) throw new ServiceError(403, 'You are not a member of this group.')
        group.memberStudentIds = group.memberStudentIds.filter((s) => s !== me.account.id)
        if (!group.memberStudentIds.length) store.groups = store.groups.filter((g) => g.id !== id)
      }
      group.version++
    }),
  )
}

export async function releaseAssignmentGrades(id: number): Promise<void> {
  const { gradingMethods } = await import('./grading-service')
  const queue = await gradingMethods.queue(id, { pageSize: 10000 })
  if (!queue.canGrade) throw new ServiceError(409, 'Grading opens after cutoff.')
  for (const subject of queue.items) {
    const grade = subject.grade
    if (
      grade?.draftRevision &&
      grade.draftRevision.revisionNo !== grade.publishedRevision?.revisionNo
    )
      await gradingMethods.publishGrade(id, grade.id, grade.draftRevision.revisionNo, grade.version)
  }
}
