import type { CalendarItem, Offering } from '@/services/contracts'
import { current } from './services'
import { getStore } from './store'
import { requireAcademic } from './policy'
export function scopedOfferings(): Offering[] {
  const s = getStore(),
    me = current().me.account
  return s.offerings.filter(
    (o) =>
      me.role === 'ADMIN' ||
      ((me.role !== 'STUDENT' || o.status !== 'DRAFT') &&
        s.memberships.some(
          (m) => m.offeringId === o.id && m.account.id === me.id && m.status === 'ACTIVE',
        )),
  )
}
export function checklist(offeringId: number, studentId: number) {
  const s = getStore()
  const materials = s.materials
    .filter(
      (m) =>
        m.offeringId === offeringId &&
        m.status === 'PUBLISHED' &&
        s.workspace.materialMeta[m.id]?.mandatory,
    )
    .map((m) => {
      const complete = s.workspace.completions.some(
        (c) => c.resourceId === m.id && c.studentId === studentId,
      )
      return {
        id: `material-${m.id}`,
        title: m.title,
        kind: 'MATERIAL',
        complete,
        reason: complete ? 'Manually marked completed' : 'Not marked completed',
        href: `/offerings/${offeringId}/materials/${m.id}`,
      }
    })
  const assignments = s.assignments
    .filter(
      (a) =>
        a.offeringId === offeringId &&
        a.status === 'PUBLISHED' &&
        s.assessment.meta[a.id]?.mandatory,
    )
    .map((a) => {
      const sub = s.submissions.find(
          (sub) => sub.assignmentId === a.id && sub.recipientStudentIds.includes(studentId),
        ),
        complete = !!sub?.currentVersion
      return {
        id: `assignment-${a.id}`,
        title: a.title,
        kind: 'ASSIGNMENT',
        complete,
        reason: complete
          ? `Valid confirmed version ${sub.currentVersion!.versionNo}`
          : a.mode === 'GROUP'
            ? 'No valid submission for frozen recipients; check your group assignment'
            : 'No confirmed submission; a missing-zero is incomplete',
        href: `/assignments/${a.id}`,
      }
    })
  const quizzes = s.quizzes
    .filter(
      (q) =>
        q.offeringId === offeringId &&
        q.status === 'PUBLISHED' &&
        s.quizEngine.details[q.id]?.mandatory,
    )
    .map((q) => {
      const a = s.quizEngine.attempts.find((a) => a.quizId === q.id && a.studentId === studentId),
        complete = a?.finalization === 'SUCCEEDED'
      return {
        id: `quiz-${q.id}`,
        title: q.title,
        kind: 'QUIZ',
        complete,
        reason: complete
          ? 'Attempt finalized; completion does not depend on score or release'
          : a?.finalization === 'ERROR'
            ? 'Finalization failed; no completion or zero score'
            : 'Attempt not finalized',
        href: `/quizzes/${q.id}`,
      }
    })
  return [...materials, ...assignments, ...quizzes]
}
export function progressRows(offeringId: number) {
  const { me, teacher } = requireAcademic(offeringId),
    s = getStore()
  return s.memberships
    .filter(
      (m) =>
        m.offeringId === offeringId &&
        m.status === 'ACTIVE' &&
        m.role === 'STUDENT' &&
        (teacher || m.account.id === me.account.id),
    )
    .map((m) => {
      const items = checklist(offeringId, m.account.id),
        completed = items.filter((i) => i.complete).length
      return {
        offeringId,
        membershipId: m.id,
        studentId: m.account.id,
        displayName: s.accounts.find((a) => a.account.id === m.account.id)!.account.displayName,
        completed,
        total: items.length,
        percent: items.length ? Math.round((completed / items.length) * 100) : null,
        items,
      }
    })
}
export function calendarRows(): (CalendarItem & {
  status: string
  section: string
  type: string
})[] {
  const s = getStore(),
    me = current().me.account,
    sections = scopedOfferings()
  if (me.role === 'ADMIN') return []
  const section = new Map(sections.map((o) => [o.id, `${o.courseCode} · ${o.sectionCode}`]))
  const visible = (id: number, status: string) =>
    section.has(id) && status !== 'ARCHIVED' && (me.role === 'INSTRUCTOR' || status === 'PUBLISHED')
  const assignments = s.assignments
    .filter((a) => visible(a.offeringId, a.status))
    .map((a) => {
      const sub =
        me.role === 'STUDENT'
          ? s.submissions.find(
              (sub) => sub.assignmentId === a.id && sub.recipientStudentIds.includes(me.id),
            )
          : undefined
      return {
        id: `assignment-${a.id}`,
        offeringId: a.offeringId,
        section: section.get(a.offeringId)!,
        kind: 'ASSIGNMENT_DUE' as const,
        type: a.mode === 'GROUP' ? 'Group assignment' : 'Individual assignment',
        title: a.title,
        at: a.dueAt,
        targetUri: `/assignments/${a.id}`,
        status:
          me.role === 'INSTRUCTOR'
            ? a.status
            : sub?.currentVersion
              ? `Submitted · Version ${sub.currentVersion.versionNo}`
              : 'Not submitted',
      }
    })
  const quizzes = s.quizzes
    .filter((q) => visible(q.offeringId, q.status))
    .map((q) => {
      const attempt =
        me.role === 'STUDENT'
          ? s.quizEngine.attempts.find((a) => a.quizId === q.id && a.studentId === me.id)
          : undefined
      let status: string = q.status
      if (me.role === 'STUDENT') {
        if (attempt?.releasedAt) status = 'Result released'
        else if (attempt?.finalization === 'SUCCEEDED') status = 'Finalized · awaiting release'
        else if (attempt?.finalization === 'ERROR') status = 'Finalization failed'
        else if (attempt?.status === 'SEALED') status = 'Awaiting finalization'
        else if (attempt) status = 'In progress'
        else status = 'Not started'
      }
      return {
        id: `quiz-${q.id}`,
        offeringId: q.offeringId,
        section: section.get(q.offeringId)!,
        kind: 'QUIZ_CLOSE' as const,
        type: 'Quiz close',
        title: q.title,
        at: q.closeAt,
        targetUri: `/quizzes/${q.id}`,
        status,
      }
    })
  return [...assignments, ...quizzes].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export function safeTarget(uri: string, offeringId: number): string | null {
  if (!uri.startsWith('/') || uri.startsWith('//') || /[\\\r\n]/.test(uri)) return null
  const o = scopedOfferings().find((o) => o.id === offeringId)
  if (!o) return null
  const me = current().me.account,
    s = getStore(),
    u = new URL(uri, 'https://elio.invalid')
  if (u.origin !== 'https://elio.invalid') return null
  if (u.pathname === `/offerings/${offeringId}` || u.pathname === `/offerings/${offeringId}/team`)
    return me.role !== 'STUDENT' || !u.pathname.endsWith('/team') ? uri : null
  if (me.role === 'ADMIN') return null
  if (u.pathname === `/offerings/${offeringId}/announcements`)
    return s.workspace.announcements.some((a) => a.offeringId === offeringId && a.published)
      ? uri
      : null
  if (u.pathname === `/offerings/${offeringId}/materials`) return uri
  const material = u.pathname.match(/^\/offerings\/(\d+)\/materials\/(\d+)$/)
  if (material)
    return Number(material[1]) === offeringId &&
      s.materials.some(
        (m) =>
          m.id === Number(material[2]) &&
          m.offeringId === offeringId &&
          (me.role === 'INSTRUCTOR' || m.status === 'PUBLISHED'),
      )
      ? uri
      : null
  const activity = u.pathname.match(/^\/(assignments|quizzes)\/(\d+)(\/grading)?$/)
  if (activity) {
    const items = activity[1] === 'assignments' ? s.assignments : s.quizzes
    return (!activity[3] || (activity[1] === 'assignments' && me.role === 'INSTRUCTOR')) &&
      items.some(
        (a) =>
          a.id === Number(activity[2]) &&
          a.offeringId === offeringId &&
          (me.role === 'INSTRUCTOR' ||
            (activity[1] === 'quizzes' ? a.status !== 'DRAFT' : a.status === 'PUBLISHED')),
      )
      ? uri
      : null
  }
  const attempt = u.pathname.match(/^\/quiz-attempts\/(\d+)$/)
  if (attempt)
    return me.role === 'STUDENT' &&
      s.quizEngine.attempts.some(
        (a) =>
          a.id === Number(attempt[1]) &&
          a.studentId === me.id &&
          s.quizzes.some(
            (q) => q.id === a.quizId && q.offeringId === offeringId && q.status !== 'DRAFT',
          ),
      )
      ? uri
      : null
  if (u.pathname === '/results' && Number(u.searchParams.get('offeringId')) === offeringId)
    return uri
  return null
}
