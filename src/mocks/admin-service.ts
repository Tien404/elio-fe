import type { MeView, Role } from '@/services/contracts'
import type { AdminQuery } from '@/services/personal-contracts'
import { current, verifier } from './services'
import { getStore, commit, now } from './store'
import { request } from './scenarios'
import { nextId, page, matches, version, requireReason, text } from './policy'
import { ServiceError } from '@/services/errors'

function admin() {
  const me = current().me
  if (me.account.role !== 'ADMIN')
    throw new ServiceError(403, 'Administrator operational access is required.')
  return me
}
function log(action: string, targetId: number, reason: string) {
  const s = getStore()
  s.personal.audits.push({
    id: nextId(s.personal.audits),
    actorId: admin().account.id,
    action,
    targetId,
    reason,
    occurredAt: new Date(now()).toISOString(),
  })
}
function leads(id: number) {
  const s = getStore()
  return s.offerings.filter(
    (o) =>
      o.status !== 'ARCHIVED' &&
      s.memberships.some(
        (m) => m.id === o.leadMembershipId && m.account.id === id && m.status === 'ACTIVE',
      ),
  )
}
function credential() {
  return `Demo-${crypto.randomUUID()}!`
}
export const mockAdmin = {
  accounts: (q: AdminQuery = {}) =>
    request((p) => {
      admin()
      return page(
        getStore()
          .accounts.filter(
            (a) =>
              matches(q.search, a.email, a.account.displayName, a.account.id) &&
              (!q.role || q.role === 'ALL' || a.account.role === q.role) &&
              (!q.status || q.status === 'ALL' || a.account.status === q.status),
          )
          .map((a) => ({ ...a, leadResponsibilities: leads(a.account.id) })),
        q,
        p === 'empty',
      )
    }),
  provision: (input: {
    email: string
    displayName: string
    role: Role
    canCreateCourse: boolean
  }) =>
    request(async () => {
      const actor = admin().account.id,
        email = input.email.trim().toLowerCase(),
        displayName = text(input.displayName, 'Display name', 120)
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        email.length > 254 ||
        !['STUDENT', 'INSTRUCTOR', 'ADMIN'].includes(input.role) ||
        (input.canCreateCourse && input.role !== 'INSTRUCTOR')
      )
        throw new ServiceError(422, 'Enter a valid email, role and instructor-only capability.')
      const temporaryPassword = credential(),
        hash = await verifier(temporaryPassword)
      return commit(() => {
        if (admin().account.id !== actor) throw new ServiceError(403, 'Current operator changed.')
        const s = getStore()
        if (s.accounts.some((a) => a.email.toLowerCase() === email))
          throw new ServiceError(409, 'Email is already provisioned.')
        const me: MeView = {
          email,
          account: {
            id: nextId(s.accounts.map((a) => a.account)),
            displayName,
            role: input.role,
            status: 'ACTIVE',
            mustChangePassword: true,
          },
          canCreateCourse: input.canCreateCourse,
          version: 1,
        }
        s.accounts.push(me)
        s.passwordVerifiers[me.account.id] = hash
        log(
          'ACCOUNT_PROVISIONED',
          me.account.id,
          'Account provisioned; temporary credential delivered separately.',
        )
        return { accountId: me.account.id, temporaryPassword }
      })
    }),
  update: (
    id: number,
    input: {
      status?: 'ACTIVE' | 'LOCKED'
      canCreateCourse?: boolean
      reason: string
      expectedVersion: number
    },
  ) =>
    request(() =>
      commit(() => {
        admin()
        const s = getStore(),
          a = s.accounts.find((a) => a.account.id === id)
        if (!a) throw new ServiceError(404, 'Account not found.')
        version(a.version, input.expectedVersion)
        const reason = requireReason(input.reason)
        if (input.status === undefined && input.canCreateCourse === undefined)
          throw new ServiceError(422, 'Choose an account operation.')
        if (input.status === 'LOCKED' && leads(id).length)
          throw new ServiceError(
            409,
            'Transfer all Draft/Open lead responsibilities before locking this account.',
          )
        if (input.canCreateCourse !== undefined && a.account.role !== 'INSTRUCTOR')
          throw new ServiceError(
            422,
            'Course-creation capability is available only to instructors.',
          )
        if (input.status !== undefined && !['ACTIVE', 'LOCKED'].includes(input.status))
          throw new ServiceError(422, 'Invalid account status.')
        log(
          input.status
            ? `ACCOUNT_${input.status === 'LOCKED' ? 'LOCKED' : 'UNLOCKED'}`
            : 'COURSE_CREATION_CAPABILITY_CHANGED',
          id,
          reason,
        )
        if (input.status) a.account.status = input.status
        if (input.canCreateCourse !== undefined) a.canCreateCourse = input.canCreateCourse
        a.version++
        for (const m of s.memberships.filter((m) => m.account.id === id))
          m.account = { ...a.account }
        if (input.status === 'LOCKED' && s.session?.accountId === id) s.session = null
        return a
      }),
    ),
  resetPassword: (id: number, reason: string, expectedVersion: number) =>
    request(async () => {
      const actor = admin().account.id,
        temporaryPassword = credential(),
        hash = await verifier(temporaryPassword)
      return commit(() => {
        if (admin().account.id !== actor) throw new ServiceError(403, 'Current operator changed.')
        const s = getStore(),
          a = s.accounts.find((a) => a.account.id === id)
        if (!a) throw new ServiceError(404, 'Account not found.')
        version(a.version, expectedVersion)
        log('TEMPORARY_PASSWORD_RESET', id, requireReason(reason))
        a.account.mustChangePassword = true
        a.version++
        s.passwordVerifiers[id] = hash
        if (s.session?.accountId === id) s.session = null
        return { accountId: a.account.id, temporaryPassword }
      })
    }),
  audit: (q: AdminQuery = {}) =>
    request((p) => {
      admin()
      const s = getStore()
      const rows = [
        ...s.personal.audits.map((a) => ({
          ...a,
          key: `account-${a.id}`,
          targetKind: a.targetKind ?? 'ACCOUNT',
          offeringId: null as number | null,
        })),
        ...s.workspace.audits
          .filter((a) => ['OFFERING', 'MEMBERSHIP', 'ACCOUNT'].includes(a.entry.targetKind))
          .map((a) => ({
            id: a.entry.id,
            key: `team-${a.entry.id}`,
            actorId: a.actor.id,
            action: a.entry.action,
            targetId: a.entry.targetId,
            reason: a.reason,
            occurredAt: a.entry.occurredAt,
            targetKind: a.entry.targetKind,
            offeringId: a.entry.offeringId,
          })),
      ]
      return page(
        rows
          .filter(
            (a) =>
              matches(q.search, a.action, a.actorId, a.targetId ?? '', a.reason) &&
              (!q.action || a.action === q.action) &&
              (!q.actorId || a.actorId === q.actorId) &&
              (!q.offeringId || a.offeringId === q.offeringId) &&
              (!q.targetType || a.targetKind === q.targetType) &&
              (!q.fromAt || a.occurredAt >= q.fromAt) &&
              (!q.toAt || a.occurredAt <= q.toAt),
          )
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
        q,
        p === 'empty',
      )
    }),
}
