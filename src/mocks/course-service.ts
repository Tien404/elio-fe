import { realAttemptGuards } from '@/mocks/quiz-runtime'
import type { CourseService, OfferingView } from '@/services/course-contracts'
import { ServiceError } from '@/services/errors'
import { current } from '@/mocks/services'
import { commit, getStore, now } from '@/mocks/store'
import { request } from '@/mocks/scenarios'
import {
  access,
  account,
  activeLead,
  audit,
  matches,
  member,
  nextId,
  page,
  requireReason,
  requireTeam,
  text,
  version,
} from '@/mocks/policy'

function view(id: number): OfferingView {
  const a = access(id),
    details = a.store.workspace.details[id]
  const historical = a.store.memberships.find((m) => m.id === a.offering.leadMembershipId)
  const published = a.store.materials.filter((m) => m.offeringId === id && m.status === 'PUBLISHED')
  return {
    offering: a.offering,
    permissions: a.permissions,
    lead: historical ? account(historical.account.id) : null,
    teachingRole: a.membership?.teachingRole ?? null,
    learningInformation: a.permissions.academic ? details.learningInformation : null,
    joinCode: a.teacher ? details.joinCode : null,
    joinEnabled: details.joinEnabled && a.offering.status === 'OPEN',
    totalMaterials: a.permissions.academic ? published.length : 0,
    completedMaterials: a.permissions.academic
      ? published.filter((m) =>
          a.store.workspace.completions.some(
            (c) => c.resourceId === m.id && c.studentId === a.me.account.id,
          ),
        ).length
      : 0,
  }
}
function uniqueSection(courseId: number, semester: string, sectionCode: string, except?: number) {
  if (
    getStore().offerings.some(
      (o) =>
        o.id !== except &&
        o.courseId === courseId &&
        o.semester.toUpperCase() === semester.toUpperCase() &&
        o.sectionCode.toUpperCase() === sectionCode.toUpperCase(),
    )
  )
    throw new ServiceError(
      409,
      'This catalog course already has that semester and section code. Choose a unique section.',
    )
}
function newCode() {
  const s = getStore(),
    alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value: string
  do {
    value = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (n) => alphabet[n % alphabet.length],
    ).join('')
  } while (s.workspace.usedCodes.includes(value))
  s.workspace.usedCodes.push(value)
  return value
}
export const mockCourses: CourseService = {
  catalog: (query = {}) =>
    request((preset) => {
      if (current().me.account.role === 'STUDENT')
        throw new ServiceError(403, 'Only instructors and administrators can browse the catalog.')
      return page(
        getStore()
          .workspace.catalog.filter((c) => matches(query.search, c.courseCode, c.courseName))
          .sort((a, b) => a.id - b.id),
        query,
        preset === 'empty',
      )
    }),
  createCatalog: (input) =>
    request(() =>
      commit(() => {
        const actor = current().me.account
        if (actor.role !== 'ADMIN') throw new ServiceError(403, 'Administrator access is required.')
        const name = text(input.courseName, 'Course name', 200)
        const faculty = input.facultyCode.toUpperCase()
        if (
          !/^[A-Z]{2,4}$/.test(faculty) ||
          !Number.isInteger(input.yearLevel) ||
          input.yearLevel < 1 ||
          input.yearLevel > 9 ||
          input.credits <= 0 ||
          input.credits > 99.9 ||
          !Number.isInteger(input.credits * 10)
        ) {
          throw new ServiceError(400, 'Check the faculty code, year level and credits.')
        }
        const store = getStore()
        const catalog = store.workspace.catalog
        const degree = ['UNDERGRADUATE', 'MASTERS', 'PHD'].indexOf(input.degreeLevel)
        const stem = `${faculty}${input.yearLevel}${degree}`
        const number =
          1 +
          Math.max(
            0,
            ...catalog
              .filter(
                (c) => c.courseCode.startsWith(stem) && c.courseCode.length === stem.length + 2,
              )
              .map((c) => Number(c.courseCode.slice(stem.length)) || 0),
          )
        if (number > 99) throw new ServiceError(409, 'All course codes for this prefix are in use.')
        const item = {
          id: nextId(catalog),
          courseCode: `${stem}${String(number).padStart(2, '0')}`,
          courseName: name,
          credits: input.credits,
        }
        catalog.push(item)
        store.personal.audits.push({
          id: nextId(store.personal.audits),
          actorId: actor.id,
          action: 'COURSE_CREATED',
          targetKind: 'COURSE',
          targetId: item.id,
          reason: '',
          occurredAt: new Date(now()).toISOString(),
        })
        return item
      }),
    ),
  catalogDetail: (id) =>
    request(() => {
      if (current().me.account.role === 'STUDENT')
        throw new ServiceError(403, 'Only instructors and administrators can browse the catalog.')
      const item = getStore().workspace.catalog.find((c) => c.id === id)
      if (!item) throw new ServiceError(404, 'Catalog course not found.')
      return item
    }),
  list: (query = {}) =>
    request((preset) => {
      const { me } = current(),
        s = getStore()
      const ids = s.memberships
        .filter((m) => m.account.id === me.account.id && m.status === 'ACTIVE')
        .map((m) => m.offeringId)
      const rows = s.offerings
        .filter(
          (o) =>
            (me.account.role === 'ADMIN' || ids.includes(o.id)) &&
            (me.account.role !== 'STUDENT' || o.status !== 'DRAFT') &&
            (!query.courseId || o.courseId === query.courseId) &&
            (!query.semester || o.semester.toLowerCase().includes(query.semester.toLowerCase())) &&
            (!query.status || o.status === query.status) &&
            matches(query.search, o.courseCode, o.title, o.sectionCode),
        )
        .sort((a, b) => {
          switch (query.sort) {
            case 'newest':
              return b.id - a.id
            case 'title-asc':
              return a.title.localeCompare(b.title) || a.id - b.id
            case 'title-desc':
              return b.title.localeCompare(a.title) || a.id - b.id
            case 'semester':
              return (
                b.semester.localeCompare(a.semester, undefined, { numeric: true }) || a.id - b.id
              )
            default:
              return a.id - b.id
          }
        })
      const result = page(rows, query, preset === 'empty')
      return { ...result, items: result.items.map((o) => view(o.id)) }
    }),
  get: (id) => request(() => view(id)),
  create: (input) =>
    request(() =>
      commit(() => {
        const { me } = current(),
          s = getStore()
        if (me.account.role !== 'INSTRUCTOR' || !me.canCreateCourse)
          throw new ServiceError(
            403,
            'Course creation capability is required for an active instructor.',
          )
        const code = text(input.courseCode, 'Course code', 40).toUpperCase(),
          title = text(input.title, 'Title', 200),
          semester = text(input.semester, 'Semester', 40).toUpperCase(),
          sectionCode = text(input.sectionCode, 'Section code', 40).toUpperCase()
        if (input.learningInformation.length > 10000)
          throw new ServiceError(422, 'Learning information must not exceed 10,000 characters.')
        let catalog = s.workspace.catalog.find((c) => c.courseCode.toUpperCase() === code)
        if (!catalog) {
          if (!Number.isFinite(input.credits) || input.credits! <= 0)
            throw new ServiceError(422, 'A new catalog subject requires positive credits.')
          catalog = {
            id: nextId(s.workspace.catalog),
            courseCode: code,
            courseName: text(input.courseName ?? '', 'Course name', 200),
            credits: input.credits!,
          }
          s.workspace.catalog.push(catalog)
        }
        uniqueSection(catalog.id, semester, sectionCode)
        const id = nextId(s.offerings),
          membershipId = nextId(s.memberships)
        s.offerings.push({
          id,
          courseId: catalog.id,
          courseCode: catalog.courseCode,
          title,
          semester,
          sectionCode,
          status: 'DRAFT',
          leadMembershipId: membershipId,
          version: 1,
        })
        s.memberships.push({
          id: membershipId,
          offeringId: id,
          account: { ...me.account },
          role: 'INSTRUCTOR',
          teachingRole: 'LEAD',
          status: 'ACTIVE',
          version: 1,
        })
        s.workspace.details[id] = {
          learningInformation: input.learningInformation.trim(),
          joinCode: newCode(),
          joinEnabled: true,
        }
        audit(id, 'OFFERING_CREATED', id, 'Course section created with an active lead.')
        return view(id)
      }),
    ),
  edit: (id, input, expectedVersion) =>
    request(() =>
      commit(() => {
        const a = access(id)
        if (!a.permissions.edit)
          throw new ServiceError(403, 'Only the current lead can edit a writable course section.')
        version(a.offering.version, expectedVersion)
        const title = text(input.title, 'Title', 200),
          semester = text(input.semester, 'Semester', 40).toUpperCase(),
          sectionCode = text(input.sectionCode, 'Section code', 40).toUpperCase()
        if (input.learningInformation.length > 10000)
          throw new ServiceError(422, 'Learning information must not exceed 10,000 characters.')
        uniqueSection(a.offering.courseId, semester, sectionCode, id)
        Object.assign(a.offering, { title, semester, sectionCode, version: a.offering.version + 1 })
        a.store.workspace.details[id].learningInformation = input.learningInformation.trim()
        audit(id, 'OFFERING_UPDATED', id, 'Metadata updated.')
        return view(id)
      }),
    ),
  transition: (id, action, reason, expectedVersion) =>
    request(() =>
      commit(() => {
        const a = access(id)
        version(a.offering.version, expectedVersion)
        if (!a.permissions[action])
          throw new ServiceError(
            403,
            'Your current role or the course section state does not allow this transition.',
          )
        const safeReason =
          action === 'publish' ? 'Course section published.' : requireReason(reason)
        if (action === 'archive') {
          const attempts = [
            ...a.store.workspace.attemptGuards.filter((x) => x.offeringId === id),
            ...realAttemptGuards(id),
          ].filter((x) => x.finalization !== 'SUCCEEDED')
          if (attempts.some((x) => Date.parse(x.endAt) > now() && (!('active' in x) || x.active)))
            throw new ServiceError(
              409,
              'An unexpired quiz attempt blocks archive. Wait for it to end and finalize successfully.',
            )
          if (attempts.length)
            throw new ServiceError(
              409,
              'Pending or failed quiz finalization blocks archive. Processing errors are not zero scores.',
            )
          a.offering.status = 'ARCHIVED'
        } else {
          if (!activeLead(a.offering))
            throw new ServiceError(
              409,
              'Repair the teaching team with an active lead before publication or restore.',
            )
          a.offering.status = 'OPEN'
        }
        a.offering.version += 1
        audit(id, `OFFERING_${action.toUpperCase()}`, id, safeReason)
        return view(id)
      }),
    ),
  join: (id, code) =>
    request(() =>
      commit(() => {
        const { me } = current(),
          s = getStore(),
          value = code.trim().toUpperCase()
        if (me.account.role !== 'STUDENT')
          throw new ServiceError(403, 'Only active student accounts can join course sections.')
        if (!/^[A-Z0-9]{6}$/.test(value))
          throw new ServiceError(
            422,
            'Enter the six-character join code supplied by your instructor.',
          )
        const o = s.offerings.find((o) => o.id === id),
          meta = s.workspace.details[id]
        if (!o || o.status !== 'OPEN' || !meta?.joinEnabled || meta.joinCode !== value)
          throw new ServiceError(
            404,
            'The section or join code is unavailable. Confirm both with your instructor.',
          )
        const existing = s.memberships.find(
          (m) => m.offeringId === id && m.account.id === me.account.id,
        )
        if (existing?.status === 'ACTIVE')
          throw new ServiceError(409, 'You are already enrolled in this course section.')
        if (existing) {
          existing.status = 'ACTIVE'
          existing.version += 1
        } else
          s.memberships.push({
            id: nextId(s.memberships),
            offeringId: id,
            account: { ...me.account },
            role: 'STUDENT',
            teachingRole: null,
            status: 'ACTIVE',
            version: 1,
          })
        audit(id, 'STUDENT_JOINED', me.account.id, 'Joined using a valid section code.', 'ACCOUNT')
        return view(id)
      }),
    ),
  members: (id, query = {}) =>
    request((preset) => {
      const a = access(id)
      const rows = a.store.memberships
        .filter(
          (m) =>
            m.offeringId === id &&
            m.role === 'STUDENT' &&
            (a.teacher || a.admin || m.status === 'ACTIVE') &&
            (!query.status || m.status === query.status),
        )
        .map(member)
        .filter((m) => matches(query.search, m.account.displayName, m.account.id))
        .sort((a, b) => a.id - b.id)
      return page(rows, query, preset === 'empty')
    }),
  candidates: (id, role, query = {}) =>
    request((preset) => {
      const a = access(id)
      if (
        role === 'STUDENT'
          ? !a.permissions.enroll
          : !a.permissions.manageTeam && !a.permissions.repairLead
      )
        throw new ServiceError(
          403,
          'Your current permission does not allow account selection for this action.',
        )
      return page(
        a.store.accounts
          .map((a) => a.account)
          .filter(
            (c) =>
              c.role === role &&
              c.status === 'ACTIVE' &&
              !a.store.memberships.some(
                (m) => m.offeringId === id && m.account.id === c.id && m.status === 'ACTIVE',
              ) &&
              matches(query.search, c.id, c.displayName),
          )
          .sort((a, b) => a.id - b.id),
        query,
        preset === 'empty',
      )
    }),
  enroll: (id, accountId) =>
    request(() =>
      commit(() => {
        const a = access(id)
        if (!a.permissions.enroll)
          throw new ServiceError(
            403,
            'Current teaching access in a writable course section is required to enroll a student.',
          )
        const student = account(accountId)
        if (student.role !== 'STUDENT' || student.status !== 'ACTIVE')
          throw new ServiceError(422, 'Select an active existing student account.')
        let m = a.store.memberships.find((m) => m.offeringId === id && m.account.id === accountId)
        if (m?.status === 'ACTIVE')
          throw new ServiceError(409, 'This account already has an active membership.')
        if (m) {
          m.status = 'ACTIVE'
          m.version += 1
        } else {
          m = {
            id: nextId(a.store.memberships),
            offeringId: id,
            account: { ...student },
            role: 'STUDENT',
            teachingRole: null,
            status: 'ACTIVE',
            version: 1,
          }
          a.store.memberships.push(m)
        }
        audit(
          id,
          'STUDENT_ENROLLED',
          accountId,
          'Manual enrollment of an existing active student.',
          'ACCOUNT',
        )
        return member(m)
      }),
    ),
  joinCode: (id, action, expectedVersion) =>
    request(() =>
      commit(() => {
        const a = access(id)
        if (!a.permissions.manageCode)
          throw new ServiceError(
            403,
            'Only the current lead can manage join codes in a writable course section.',
          )
        version(a.offering.version, expectedVersion)
        const meta = a.store.workspace.details[id]
        if (action === 'rotate') {
          meta.joinCode = newCode()
          meta.joinEnabled = true
        } else meta.joinEnabled = false
        a.offering.version += 1
        audit(
          id,
          `JOIN_CODE_${action.toUpperCase()}`,
          id,
          'Join code changed; existing memberships preserved.',
        )
        return view(id)
      }),
    ),
  team: (id, query = {}) =>
    request((preset) => {
      const a = access(id)
      return page(
        a.store.memberships
          .filter(
            (m) =>
              m.offeringId === id &&
              m.role === 'INSTRUCTOR' &&
              (a.teacher || a.admin || m.status === 'ACTIVE'),
          )
          .map(member)
          .filter((m) => matches(query.search, m.account.id, m.account.displayName))
          .sort((a, b) => a.id - b.id),
        query,
        preset === 'empty',
      )
    }),
  addInstructor: (id, accountId, reason) =>
    request(() =>
      commit(() => {
        const a = requireTeam(id)
        const instructor = account(accountId)
        if (instructor.role !== 'INSTRUCTOR' || instructor.status !== 'ACTIVE')
          throw new ServiceError(422, 'Select an active existing instructor account.')
        const safeReason = a.admin
          ? requireReason(reason)
          : reason.trim() || 'Co-instructor added by the current lead.'
        const existing = a.store.memberships.find(
          (m) => m.offeringId === id && m.account.id === accountId,
        )
        if (existing?.status === 'ACTIVE')
          throw new ServiceError(409, 'This instructor is already an active team member.')
        if (existing) {
          existing.status = 'ACTIVE'
          existing.teachingRole = 'CO_INSTRUCTOR'
          existing.version += 1
        } else
          a.store.memberships.push({
            id: nextId(a.store.memberships),
            offeringId: id,
            account: { ...instructor },
            role: 'INSTRUCTOR',
            teachingRole: 'CO_INSTRUCTOR',
            status: 'ACTIVE',
            version: 1,
          })
        a.offering.version += 1
        audit(id, 'INSTRUCTOR_ADDED', accountId, safeReason, 'ACCOUNT')
        return view(id)
      }),
    ),
  removeInstructor: (id, membershipId, reason) =>
    request(() =>
      commit(() => {
        const a = requireTeam(id)
        if (a.offering.status === 'ARCHIVED')
          throw new ServiceError(
            403,
            'Archived teams are read-only except for repairing an active lead before restore.',
          )
        const safeReason = requireReason(reason),
          m = a.store.memberships.find(
            (m) =>
              m.id === membershipId &&
              m.offeringId === id &&
              m.role === 'INSTRUCTOR' &&
              m.status === 'ACTIVE',
          )
        if (!m) throw new ServiceError(404, 'Active instructor membership not found.')
        if (m.id === a.offering.leadMembershipId || m.teachingRole === 'LEAD')
          throw new ServiceError(409, 'Transfer leadership before removing the current lead.')
        m.status = 'REMOVED'
        m.version += 1
        a.offering.version += 1
        audit(id, 'INSTRUCTOR_REMOVED', m.account.id, safeReason, 'ACCOUNT')
        return view(id)
      }),
    ),
  transfer: (id, membershipId, reason) =>
    request(async () => {
      const actor = current().me.account.id
      return commit(() => {
        if (current().me.account.id !== actor)
          throw new ServiceError(403, 'The active account changed. Review this transfer again.')
        const a = requireTeam(id)
        const safeReason = requireReason(reason),
          replacement = a.store.memberships.find(
            (m) =>
              m.id === membershipId &&
              m.offeringId === id &&
              m.status === 'ACTIVE' &&
              m.role === 'INSTRUCTOR' &&
              m.teachingRole === 'CO_INSTRUCTOR',
          )
        if (
          !replacement ||
          account(replacement.account.id).status !== 'ACTIVE' ||
          account(replacement.account.id).role !== 'INSTRUCTOR'
        )
          throw new ServiceError(422, 'Select a current active co-instructor as the new lead.')
        for (const m of a.store.memberships.filter(
          (m) => m.offeringId === id && m.teachingRole === 'LEAD',
        )) {
          m.teachingRole = 'CO_INSTRUCTOR'
          m.version += 1
        }
        replacement.teachingRole = 'LEAD'
        replacement.version += 1
        a.offering.leadMembershipId = replacement.id
        a.offering.version += 1
        audit(id, 'LEAD_TRANSFERRED', replacement.account.id, safeReason, 'ACCOUNT')
        return view(id)
      })
    }),
  audit: (id, query = {}) =>
    request((preset) => {
      const a = access(id)
      if (!a.lead && !a.admin)
        throw new ServiceError(
          403,
          'Only the current lead or an authorized administrator can review operational audit records.',
        )
      return page(
        a.store.workspace.audits
          .filter((a) => a.entry.offeringId === id)
          .sort((a, b) => b.entry.id - a.entry.id)
          .map(({ entry, actor, reason }) => ({
            key: String(entry.id),
            actorId: actor.id,
            actorName: actor.displayName,
            action: entry.action,
            targetKind: entry.targetKind,
            targetId: entry.targetId,
            occurredAt: entry.occurredAt,
            reason,
          })),
        query,
        preset === 'empty',
      )
    }),
}
