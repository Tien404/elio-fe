import type { AccountSummary, Membership, Offering } from '@/services/contracts'
import type { OfferingPermissions, Page, PageQuery } from '@/services/course-contracts'
import { ServiceError } from '@/services/errors'
import { current } from '@/mocks/services'
import { getStore, now } from '@/mocks/store'

export function positive(id: number) {
  if (!Number.isSafeInteger(id) || id < 1) throw new ServiceError(404, 'Resource not found.')
}
export function text(value: string, label: string, max: number) {
  if (!value.trim() || value.trim().length > max)
    throw new ServiceError(422, `${label} must contain 1–${max} characters.`, {
      [label]: `Enter 1–${max} characters.`,
    })
  return value.trim()
}
export function version(actual: number, expected?: number) {
  if (expected !== actual)
    throw new ServiceError(
      412,
      'This resource changed. Your input has been kept. Review the latest saved version before continuing.',
    )
}
export function nextId(items: { id: number }[]) {
  return Math.max(0, ...items.map((i) => i.id)) + 1
}
export function page<T>(rows: T[], query: PageQuery = {}, empty = false): Page<T> {
  const p = query.page ?? 1,
    size = query.pageSize ?? 25
  if (!Number.isInteger(p) || p < 1 || !Number.isInteger(size) || size < 1 || size > 100)
    throw new ServiceError(422, 'Page must be positive. Page size must be between 1 and 100.')
  const items = empty ? [] : rows
  return {
    items: items.slice((p - 1) * size, p * size),
    page: p,
    pageSize: size,
    totalItems: items.length,
    totalPages: Math.ceil(items.length / size),
  }
}
export function matches(query: string | undefined, ...values: (string | number)[]) {
  return !query || values.join(' ').toLowerCase().includes(query.trim().toLowerCase())
}
export function account(id: number): AccountSummary {
  const a = getStore().accounts.find((a) => a.account.id === id)
  if (!a) throw new ServiceError(404, 'Account not found.')
  return a.account
}
export function member(m: Membership): Membership {
  return { ...m, account: account(m.account.id) }
}
export function activeLead(o: Offering) {
  const m = getStore().memberships.find(
    (m) =>
      m.id === o.leadMembershipId &&
      m.offeringId === o.id &&
      m.role === 'INSTRUCTOR' &&
      m.teachingRole === 'LEAD' &&
      m.status === 'ACTIVE',
  )
  return m &&
    account(m.account.id).status === 'ACTIVE' &&
    account(m.account.id).role === 'INSTRUCTOR'
    ? m
    : null
}
export function access(id: number) {
  positive(id)
  const { me } = current()
  const store = getStore(),
    offering = store.offerings.find((o) => o.id === id)
  if (!offering) throw new ServiceError(404, 'Course section not found.')
  const membership = store.memberships.find(
    (m) => m.offeringId === id && m.account.id === me.account.id && m.status === 'ACTIVE',
  )
  const admin = me.account.role === 'ADMIN'
  if (!admin && (!membership || (me.account.role === 'STUDENT' && offering.status === 'DRAFT')))
    throw new ServiceError(403, 'You no longer have access to this course section.')
  const teacher = membership?.role === 'INSTRUCTOR' && me.account.role === 'INSTRUCTOR'
  const lead =
    teacher && membership.id === offering.leadMembershipId && membership.teachingRole === 'LEAD'
  const writable = offering.status !== 'ARCHIVED'
  const permissions: OfferingPermissions = {
    academic: !admin && !!membership,
    teach: !!teacher && writable,
    edit: !!lead && writable,
    publish: !!lead && offering.status === 'DRAFT',
    archive: (admin || !!lead) && offering.status === 'OPEN',
    restore: (admin || !!lead) && offering.status === 'ARCHIVED',
    manageTeam: (admin || !!lead) && writable,
    repairLead: admin && offering.status === 'ARCHIVED' && !activeLead(offering),
    enroll: !!teacher && writable,
    manageCode: !!lead && writable,
  }
  return { store, offering, me, membership, admin, teacher: !!teacher, lead: !!lead, permissions }
}
export function requireAcademic(id: number, write = false) {
  const a = access(id)
  if (!a.permissions.academic || (write && !a.permissions.teach))
    throw new ServiceError(
      403,
      write
        ? 'Current teaching permission in a writable course section is required.'
        : 'Operational access does not grant private academic access.',
    )
  return a
}
export function requireTeam(id: number) {
  const a = access(id)
  if (!a.permissions.manageTeam && !a.permissions.repairLead)
    throw new ServiceError(
      403,
      'Only the current lead or an authorized administrator can change this team.',
    )
  return a
}
export function requireReason(reason: string) {
  return text(reason, 'Reason', 1000)
}
export function audit(
  offeringId: number,
  action: string,
  targetId: number,
  reason: string,
  targetKind = 'OFFERING',
) {
  const s = getStore(),
    actor = current().me.account
  s.workspace.audits.push({
    entry: {
      id: nextId(s.workspace.audits.map((a) => a.entry)),
      offeringId,
      actorKind: 'HUMAN',
      action,
      targetKind,
      targetId,
      occurredAt: new Date(now()).toISOString(),
    },
    actor: { ...actor },
    reason,
  })
}
export function notify(
  offeringId: number,
  title: string,
  targetUri: string,
  recipientIds?: number[],
) {
  const s = getStore(),
    actor = current().me.account.id
  for (const m of s.memberships.filter(
    (m) =>
      m.offeringId === offeringId &&
      m.status === 'ACTIVE' &&
      m.account.id !== actor &&
      (!recipientIds || recipientIds.includes(m.account.id)) &&
      (m.role === 'INSTRUCTOR' || s.offerings.find((o) => o.id === offeringId)?.status === 'OPEN'),
  ))
    s.workspace.recipientEvents.push({
      id: nextId(s.workspace.recipientEvents),
      offeringId,
      recipientId: m.account.id,
      title,
      targetUri,
      occurredAt: new Date(now()).toISOString(),
    })
}
