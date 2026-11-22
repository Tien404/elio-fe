import { subjects } from './grading-service'
import { current } from './services'
import { getStore, commit, now } from './store'
import { request } from './scenarios'
import { page, requireAcademic, matches, activeLead } from './policy'
import { scopedOfferings, progressRows, calendarRows, safeTarget } from './projections'
import type { Notification, PersonalQuery, PersonalService } from '@/services/personal-contracts'
import { ServiceError } from '@/services/errors'

function notificationRows(): (Notification & { href: string | null })[] {
  const store = getStore(),
    recipientId = current().me.account.id
  const read = new Set(
    store.personal.read
      .filter((row) => row.recipientId === recipientId)
      .map((row) => row.notificationId),
  )
  return store.workspace.recipientEvents
    .filter((event) => event.recipientId === recipientId)
    .sort((a, b) => b.id - a.id)
    .map((event) => {
      const href = safeTarget(event.targetUri, event.offeringId)
      const activity = event.targetUri.match(
        /^\/(assignments|quizzes|quiz-attempts)\/(\d+)(?:[/?]|$)/,
      )
      const material = event.targetUri.match(/^\/offerings\/\d+\/materials\/(\d+)$/)
      const targetKind = activity
        ? ({ assignments: 'ASSIGNMENT', quizzes: 'QUIZ', 'quiz-attempts': 'QUIZ_ATTEMPT' }[
            activity[1]
          ] ?? 'OFFERING')
        : material
          ? 'RESOURCE'
          : 'OFFERING'
      return {
        id: event.id,
        offeringId: event.offeringId,
        targetKind,
        targetId: Number(activity?.[2] ?? material?.[1]) || event.offeringId,
        preview: href ? event.title : 'Destination unavailable',
        status: read.has(event.id) ? 'READ' : 'UNREAD',
        createdAt: event.occurredAt,
        href,
      }
    })
}
export const mockPersonal: PersonalService = {
  summary: () =>
    request(() => ({
      unread: notificationRows().filter((n) => n.status === 'UNREAD').length,
      semesters: [...new Set(scopedOfferings().map((o) => o.semester))],
    })),
  dashboard: () =>
    request(() => {
      const s = getStore(),
        me = current().me.account,
        sections = scopedOfferings(),
        open = sections.filter((o) => o.status === 'OPEN'),
        notifications = notificationRows()
      if (me.role === 'ADMIN')
        return {
          role: me.role,
          serverNow: new Date(now()).toISOString(),
          sections,
          metrics: [
            s.accounts.length,
            s.accounts.filter((a) => a.account.status === 'LOCKED').length,
            open.length,
            s.personal.audits.length +
              s.workspace.audits.filter((a) =>
                ['OFFERING', 'MEMBERSHIP', 'ACCOUNT'].includes(a.entry.targetKind),
              ).length,
          ],
          progress: [],
          tasks: [
            ...sections
              .filter((o) => !activeLead(o))
              .map((o) => ({
                id: `repair-${o.id}`,
                title: `${o.courseCode} · ${o.sectionCode}`,
                detail: 'Repair active lead before restore',
                href: `/offerings/${o.id}/team`,
              })),
            ...s.accounts
              .filter((a) => a.account.status === 'LOCKED')
              .map((a) => ({
                id: `locked-${a.account.id}`,
                title: a.account.displayName,
                detail: 'Locked account · review access',
                href: `/admin?search=${a.account.id}`,
              })),
          ],
          announcements: [],
          upcoming: [],
          unread: notifications.filter((n) => n.status === 'UNREAD').length,
        }
      const progress = sections.flatMap((o) => progressRows(o.id)),
        own = progress.filter((r) => r.studentId === me.id),
        tasks: { id: string; title: string; detail: string; href: string }[] = []
      if (me.role === 'STUDENT')
        for (const r of own.filter((r) => open.some((o) => o.id === r.offeringId)))
          for (const i of r.items.filter((i) => !i.complete))
            tasks.push({ id: i.id, title: i.title, detail: i.reason, href: i.href })
      else
        for (const a of s.assignments.filter(
          (a) =>
            open.some((o) => o.id === a.offeringId) &&
            a.status === 'PUBLISHED' &&
            Date.parse(a.cutoffAt) < now(),
        )) {
          const pending = subjects(a.id).filter(
            ({ submission, grade }) =>
              !grade?.publishedRevision ||
              grade.publishedRevision.revisionNo !== grade.draftRevision?.revisionNo ||
              grade.publishedRevision.sourceVersionNo !==
                (submission?.currentVersion?.versionNo ?? null),
          )
          const missing = pending.filter((subject) => !subject.submission?.currentVersion).length
          if (pending.length)
            tasks.push({
              id: `grading-${a.id}`,
              title: a.title,
              detail: `${pending.length} awaiting a published decision${missing ? ` · ${missing} missing submissions` : ''}`,
              href: `/assignments/${a.id}/grading`,
            })
        }
      if (me.role === 'INSTRUCTOR')
        for (const q of s.quizzes.filter((q) => sections.some((o) => o.id === q.offeringId))) {
          const pending = s.quizEngine.attempts.filter(
            (a) =>
              a.quizId === q.id && a.status !== 'IN_PROGRESS' && a.finalization !== 'SUCCEEDED',
          ).length
          if (pending)
            tasks.push({
              id: `finalize-${q.id}`,
              title: q.title,
              detail: `${pending} attempts awaiting successful finalization`,
              href: `/quizzes/${q.id}/attempts`,
            })
        }
      if (me.role === 'INSTRUCTOR') {
        for (const m of s.materials.filter(
          (m) => open.some((o) => o.id === m.offeringId) && m.status === 'DRAFT',
        ))
          tasks.push({
            id: `material-${m.id}`,
            title: m.title,
            detail: 'Material draft ready for review and publication',
            href: `/offerings/${m.offeringId}/materials/${m.id}`,
          })
        for (const a of s.assignments.filter((a) => open.some((o) => o.id === a.offeringId))) {
          if (a.status === 'DRAFT')
            tasks.push({
              id: `draft-${a.id}`,
              title: a.title,
              detail: 'Assignment draft',
              href: `/assignments/${a.id}`,
            })
          if (a.mode === 'GROUP' && a.status !== 'ARCHIVED')
            tasks.push({
              id: `group-${a.id}`,
              title: a.title,
              detail: 'Manage assigned group recipients',
              href: `/assignments/${a.id}/groups`,
            })
        }
      }
      const total = own.reduce((n, r) => n + r.total, 0),
        completed = own.reduce((n, r) => n + r.completed, 0)
      return {
        role: me.role,
        serverNow: new Date(now()).toISOString(),
        sections,
        metrics:
          me.role === 'STUDENT'
            ? [
                open.length,
                tasks.filter((t) => t.id.startsWith('assignment-')).length,
                tasks.filter((t) => t.id.startsWith('quiz-')).length,
                total ? Math.round((completed / total) * 100) : null,
              ]
            : [
                open.length,
                tasks.length,
                progress.length,
                notifications.filter((n) => n.status === 'UNREAD').length,
              ],
        progress: own,
        upcoming: calendarRows().filter(
          (event) => Date.parse(event.at) >= now() && Date.parse(event.at) < now() + 7 * 86_400_000,
        ),
        tasks,
        announcements: s.workspace.announcements
          .filter((a) => sections.some((o) => o.id === a.offeringId) && a.published)
          .map((a) => ({
            id: a.id,
            title: a.published!.title,
            href: `/offerings/${a.offeringId}/announcements`,
          })),
        unread: notifications.filter((n) => n.status === 'UNREAD').length,
      }
    }),
  inbox: (q: PersonalQuery = {}) =>
    request((p) => {
      const all = notificationRows()
      return {
        unread: all.filter((n) => n.status === 'UNREAD').length,
        rows: page(
          all.filter(
            (n) =>
              (!q.offeringId || n.offeringId === q.offeringId) &&
              (!q.state || q.state === 'ALL' || q.state === n.status) &&
              matches(q.search, n.preview),
          ),
          q,
          p === 'empty',
        ),
      }
    }),
  read: (id: number) =>
    request(() =>
      commit(() => {
        const s = getStore(),
          recipientId = current().me.account.id
        if (!s.workspace.recipientEvents.some((e) => e.id === id && e.recipientId === recipientId))
          throw new ServiceError(404, 'Notification not found.')
        if (!s.personal.read.some((r) => r.notificationId === id && r.recipientId === recipientId))
          s.personal.read.push({ recipientId, notificationId: id })
      }),
    ),
  destination: (notification) =>
    request(() => {
      const n = notificationRows().find((n) => n.id === notification.id)
      if (!n) throw new ServiceError(404, 'Notification not found.')
      return { href: n.href }
    }),
  calendar: (q: PersonalQuery = {}) =>
    request((p) => {
      const parse = (s: string) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
            throw new ServiceError(422, 'Use a valid Vietnam calendar date.')
          const t = Date.parse(`${s}T00:00:00+07:00`)
          if (!Number.isFinite(t) || new Date(t + 7 * 3600000).toISOString().slice(0, 10) !== s)
            throw new ServiceError(422, 'Invalid date.')
          return t
        },
        from = q.from ? parse(q.from) : -Infinity,
        to = q.to ? parse(q.to) + 86400000 : Infinity
      if (from >= to) throw new ServiceError(422, 'Range end must be on or after its start.')
      return {
        serverNow: new Date(now()).toISOString(),
        ...page(
          calendarRows().filter(
            (e) =>
              (!q.offeringId || e.offeringId === q.offeringId) &&
              (!q.kind || q.kind === 'ALL' || e.kind === q.kind) &&
              Date.parse(e.at) >= from &&
              Date.parse(e.at) < to,
          ),
          q,
          p === 'empty',
        ),
      }
    }),
  ownProgress: (query = {}) =>
    request((preset) => {
      if (current().me.account.role !== 'STUDENT')
        throw new ServiceError(403, 'Student access is required.')
      return {
        teacher: false,
        rows: page(
          scopedOfferings().flatMap((offering) => progressRows(offering.id)),
          query,
          preset === 'empty',
        ),
      }
    }),
  progress: (id: number, q: PersonalQuery = {}) =>
    request((p) => {
      const { teacher } = requireAcademic(id)
      return {
        teacher,
        rows: page(
          progressRows(id).filter(
            (r) =>
              matches(q.search, r.displayName, r.studentId) &&
              (!q.state ||
                q.state === 'ALL' ||
                (q.state === 'COMPLETE'
                  ? r.total > 0 && r.completed === r.total
                  : r.total === 0 || r.completed < r.total)),
          ),
          q,
          p === 'empty',
        ),
      }
    }),
}
