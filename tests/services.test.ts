import assert from 'node:assert/strict'
import { test } from 'node:test'
import { utcInput, vietnamInput } from '../src/services/assessment-time.ts'
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
