import type { MeView, Role } from '@/services/contracts'
export interface PageRoute {
  path: string
  title: string
  family: string
  stage: string
  icon: string
  roles?: Role[]
  capability?: 'canCreateCourse'
}
export const pages: PageRoute[] = [
  { path: '/dashboard', title: 'Dashboard', family: 'S02', stage: 'FE04', icon: 'dashboard' },
  {
    path: '/courses',
    title: 'Course catalog',
    family: 'S03',
    stage: 'FE01',
    icon: 'offerings',
    roles: ['INSTRUCTOR', 'ADMIN'],
  },
  {
    path: '/offerings/new',
    title: 'Create course section',
    family: 'S03',
    stage: 'FE01',
    icon: 'offerings',
    roles: ['INSTRUCTOR'],
    capability: 'canCreateCourse',
  },
  { path: '/offerings', title: 'Course sections', family: 'S03', stage: 'FE01', icon: 'offerings' },
  {
    path: '/offerings/:offeringId',
    title: 'Course section',
    family: 'S04',
    stage: 'FE01',
    icon: 'offerings',
  },
  {
    path: '/offerings/:offeringId/materials',
    title: 'Materials',
    family: 'S05',
    stage: 'FE01',
    icon: 'offerings',
  },
  {
    path: '/offerings/:offeringId/members',
    title: 'Members',
    family: 'S06',
    stage: 'FE01',
    icon: 'people',
  },
  {
    path: '/offerings/:offeringId/team',
    title: 'Teaching team',
    family: 'S07',
    stage: 'FE01',
    icon: 'people',
    roles: ['INSTRUCTOR', 'ADMIN'],
  },
  {
    path: '/assignments',
    title: 'Assignments',
    family: 'S08',
    stage: 'FE02',
    icon: 'assignments',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/assignments/:assignmentId',
    title: 'Submission',
    family: 'S09',
    stage: 'FE02',
    icon: 'assignments',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/assignments/:assignmentId/grading',
    title: 'Grading',
    family: 'S10',
    stage: 'FE02',
    icon: 'results',
    roles: ['INSTRUCTOR'],
  },
  {
    path: '/assignments/:assignmentId/groups',
    title: 'Assignment groups',
    family: 'S11',
    stage: 'FE02',
    icon: 'people',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/quizzes',
    title: 'Quizzes',
    family: 'S12',
    stage: 'FE03',
    icon: 'quizzes',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/quizzes/:quizId',
    title: 'Quiz',
    family: 'S12',
    stage: 'FE03',
    icon: 'quizzes',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/question-bank',
    title: 'Question bank',
    family: 'S12',
    stage: 'FE03',
    icon: 'question-bank',
    roles: ['INSTRUCTOR'],
  },
  {
    path: '/results',
    title: 'Results',
    family: 'S13',
    stage: 'FE02',
    icon: 'results',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/notifications',
    title: 'Notifications',
    family: 'S14',
    stage: 'FE04',
    icon: 'notifications',
  },
  { path: '/calendar', title: 'Calendar', family: 'S15', stage: 'FE04', icon: 'calendar' },
  {
    path: '/progress',
    title: 'Progress',
    family: 'S16',
    stage: 'FE04',
    icon: 'progress',
    roles: ['STUDENT', 'INSTRUCTOR'],
  },
  {
    path: '/admin',
    title: 'Account',
    family: 'S17',
    stage: 'FE04',
    icon: 'people',
    roles: ['ADMIN'],
  },
]
export function canAccess(page: PageRoute, me: MeView) {
  return (
    (!page.roles || page.roles.includes(me.account.role)) &&
    (!page.capability || me[page.capability])
  )
}
