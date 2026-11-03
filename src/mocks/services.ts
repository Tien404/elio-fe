import type { Identity, IdentityService, WorkspaceService } from '@/services/contracts'
import { ServiceError } from '@/services/errors'
import { DEMO_PASSWORD } from '@/mocks/seed'
import { getStore, now, persist, transientFiles } from '@/mocks/store'
import { request } from '@/mocks/scenarios'

export function current(allowRestricted = false): Identity {
  const s = getStore()
  const me = s.accounts.find((a) => a.account.id === s.session?.accountId)
  if (!me || !s.session || Date.parse(s.session.expiresAt) <= now())
    throw new ServiceError(401, 'Your session has expired. Sign in again.')
  if (me.account.status === 'LOCKED')
    throw new ServiceError(403, 'This account is locked. Contact your administrator.')
  if (!allowRestricted && me.account.mustChangePassword)
    throw new ServiceError(403, 'Change your temporary password to continue.')
  return {
    me,
    session: {
      account: me.account,
      csrfToken: 'demo-simulation-only-not-an-api-token',
      restricted: me.account.mustChangePassword,
      absoluteExpiresAt: s.session.expiresAt,
    },
  }
}
export async function verifier(value: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`elio-fake-demo-only:${value}`),
  )
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
export const mockIdentity: IdentityService = {
  restore: () =>
    request(() => {
      if (!getStore().session) return null
      return current(true)
    }),
  login: (input) =>
    request(async () => {
      const store = getStore()
      const me = store.accounts.find(
        (a) => a.email.toLowerCase() === input.email.trim().toLowerCase(),
      )
      if (
        !me ||
        (await verifier(input.password)) !==
          (store.passwordVerifiers[me.account.id] ?? (await verifier(DEMO_PASSWORD)))
      )
        throw new ServiceError(400, 'Email or password is incorrect.')
      if (me.account.status === 'LOCKED')
        throw new ServiceError(403, 'This account is locked. Contact your administrator.')
      store.session = {
        accountId: me.account.id,
        expiresAt: new Date(now() + 8 * 3_600_000).toISOString(),
      }
      persist()
      return current(true)
    }),
  logout: () =>
    request(() => {
      getStore().session = null
      persist()
    }),
  updateProfile: (displayName, expectedVersion) =>
    request(() => {
      const { me } = current()
      if (!displayName.trim() || displayName.trim().length > 120)
        throw new ServiceError(422, 'Display name must contain 1–120 characters.', {
          displayName: 'Enter 1–120 characters.',
        })
      if (me.version !== expectedVersion)
        throw new ServiceError(
          412,
          'Your profile changed in another tab. Reload the saved profile to review the latest version.',
        )
      me.account.displayName = displayName.trim()
      me.version += 1
      getStore()
        .memberships.filter((m) => m.account.id === me.account.id)
        .forEach((m) => {
          m.account = { ...me.account }
        })
      persist()
      return current()
    }),
  changePassword: (input) =>
    request(async () => {
      const { me } = current(true)
      const s = getStore()
      if (
        (await verifier(input.currentPassword)) !==
        (s.passwordVerifiers[me.account.id] ?? (await verifier(DEMO_PASSWORD)))
      )
        throw new ServiceError(422, 'Current password is incorrect.')
      if (
        input.newPassword.length < 12 ||
        input.newPassword.length > 1024 ||
        input.newPassword === input.currentPassword
      )
        throw new ServiceError(422, 'Use a different password with 12–1024 characters.')
      if (current(true).me.account.id !== me.account.id)
        throw new ServiceError(
          403,
          'The active account changed. Sign in again before changing the password.',
        )
      s.passwordVerifiers[me.account.id] = await verifier(input.newPassword)
      me.account.mustChangePassword = false
      me.version += 1
      s.session = null
      persist()
    }),
}
export const mockWorkspace: WorkspaceService = {
  listOfferings: () =>
    request((preset) => {
      const { me } = current()
      if (preset === 'empty') return []
      if (me.account.role === 'ADMIN')
        throw new ServiceError(
          403,
          'Operational admin access does not grant access to private academic content.',
        )
      const ids = getStore()
        .memberships.filter((m) => m.account.id === me.account.id && m.status === 'ACTIVE')
        .map((m) => m.offeringId)
      return getStore().offerings.filter((o) => ids.includes(o.id))
    }),
  downloadDemoAsset: () =>
    request(() => {
      current()
      return new Blob(['ELIO demo asset only.\n'], { type: 'text/plain' })
    }),
}

export { transientFiles } from '@/mocks/store'
export const mockFiles: import('@/services/contracts').FileService = {
  reselect: (fileId, file) =>
    request(async () => {
      const actor = current().me.account.id,
        s = getStore(),
        asset = s.files.find((f) => f.id === fileId)
      if (
        !asset ||
        asset.state !== 'STAGING' ||
        s.stagingOwners[fileId] !== actor ||
        Date.parse(asset.leaseExpiresAt) <= now()
      )
        throw new ServiceError(403, 'Only your live staged file can be reselected.')
      const membership = s.memberships.find(
          (m) =>
            m.offeringId === asset.offeringId && m.account.id === actor && m.status === 'ACTIVE',
        ),
        offering = s.offerings.find((o) => o.id === asset.offeringId)
      if (!membership || offering?.status === 'ARCHIVED' || current().me.account.role === 'ADMIN')
        throw new ServiceError(403, 'Current writable academic access is required.')
      const hash = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())),
        (b) => b.toString(16).padStart(2, '0'),
      ).join('')
      if (
        current().me.account.id !== actor ||
        hash !== asset.sha256 ||
        file.size !== asset.byteSize ||
        file.name !== asset.originalName
      )
        throw new ServiceError(
          409,
          'Select the same original file. Name, size and SHA-256 must match the saved upload.',
        )
      transientFiles.set(fileId, file)
      return asset
    }),
  stage: (file, offeringId, purpose) =>
    request(async () => {
      const actor = current().me.account.id
      const check = () => {
        const { me } = current(),
          store = getStore()
        const m = store.memberships.find(
          (m) =>
            m.account.id === me.account.id && m.offeringId === offeringId && m.status === 'ACTIVE',
        )
        const o = store.offerings.find((o) => o.id === offeringId)
        if (
          me.account.role === 'ADMIN' ||
          m?.role !== me.account.role ||
          me.account.id !== actor ||
          !m ||
          !o ||
          o.status === 'ARCHIVED' ||
          (me.account.role === 'STUDENT' && o.status !== 'OPEN') ||
          (purpose === 'SUBMISSION' && me.account.role !== 'STUDENT') ||
          (purpose !== 'SUBMISSION' && m.role !== 'INSTRUCTOR')
        )
          throw new ServiceError(
            403,
            'Current upload permission in a writable course section is required.',
          )
        return store
      }
      check()
      const limit = purpose === 'MATERIAL' ? 50_000_000 : 20_000_000
      if (!file.size || file.size > limit)
        throw new ServiceError(
          422,
          `Select a non-empty file up to ${limit.toLocaleString('en-US')} bytes.`,
        )
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
      const store = check()
      const asset = {
        id: Math.max(700, ...store.files.map((f) => f.id)) + 1,
        offeringId,
        originalName: file.name,
        mediaType: file.type || 'application/octet-stream',
        byteSize: file.size,
        sha256: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''),
        state: 'STAGING' as const,
        purpose,
        leaseExpiresAt: new Date(now() + 86_400_000).toISOString(),
      }
      store.files.push(asset)
      ;(store.stagingOwners ??= {})[asset.id] = actor
      persist()
      transientFiles.set(asset.id, file)
      return asset
    }),
  download: (fileId) =>
    request(() => {
      const { me } = current()
      const store = getStore()
      const file = store.files.find((f) => f.id === fileId)
      if (!file) throw new ServiceError(404, 'File not found.')
      const membership = store.memberships.find(
        (m) =>
          m.account.id === me.account.id &&
          m.offeringId === file.offeringId &&
          m.status === 'ACTIVE',
      )
      if (
        me.account.role === 'ADMIN' ||
        !membership ||
        (file.purpose === 'SUBMISSION' &&
          membership.role !== 'INSTRUCTOR' &&
          store.stagingOwners?.[file.id] !== me.account.id &&
          !store.submissions.some(
            (s) =>
              s.recipientStudentIds.includes(me.account.id) &&
              (s.currentVersion?.fileIds.includes(file.id) ||
                store.assessment.history.some(
                  (v) => v.submissionId === s.id && v.fileIds.includes(file.id),
                )),
          ))
      )
        throw new ServiceError(403, 'You do not have current access to this file.')
      if (
        file.state === 'EXPIRED' ||
        (file.state === 'STAGING' && Date.parse(file.leaseExpiresAt) <= now())
      )
        throw new ServiceError(404, 'This staged file has expired. Select the file again.')
      if (file.state === 'STAGING' && store.stagingOwners[file.id] !== me.account.id)
        throw new ServiceError(403, 'Staged private files belong to their uploader.')
      if (
        file.purpose === 'SUBMISSION' &&
        file.state === 'ATTACHED' &&
        !store.submissions.some(
          (sub) =>
            store.assignments.some(
              (a) =>
                a.id === sub.assignmentId &&
                a.offeringId === file.offeringId &&
                (membership.role === 'INSTRUCTOR' || a.status === 'PUBLISHED'),
            ) &&
            store.assessment.history.some(
              (v) => v.submissionId === sub.id && v.fileIds.includes(file.id),
            ) &&
            (membership.role === 'INSTRUCTOR' || sub.recipientStudentIds.includes(me.account.id)),
        )
      )
        throw new ServiceError(403, 'The parent submission is not available to your account.')
      const offering = store.offerings.find((o) => o.id === file.offeringId)
      if (me.account.role === 'STUDENT' && offering?.status === 'DRAFT')
        throw new ServiceError(403, 'Draft course files are not available to students.')
      if (file.purpose === 'ASSIGNMENT_ATTACHMENT') {
        if (file.state === 'STAGING' && store.stagingOwners[file.id] !== me.account.id)
          throw new ServiceError(403, 'Staged attachments belong to their uploader.')
        if (
          file.state === 'ATTACHED' &&
          !store.assignments.some(
            (a) =>
              a.offeringId === file.offeringId &&
              store.assessment.meta[a.id]?.fileIds.includes(file.id) &&
              (membership.role === 'INSTRUCTOR' || a.status === 'PUBLISHED'),
          )
        )
          throw new ServiceError(403, 'The parent assignment is not available.')
      }
      if (file.purpose === 'MATERIAL') {
        if (
          file.state === 'STAGING' &&
          (store.stagingOwners[file.id] !== me.account.id || membership.role !== 'INSTRUCTOR')
        )
          throw new ServiceError(403, 'Staged material files belong to their uploader.')
        if (
          file.state === 'ATTACHED' &&
          !store.materials.some(
            (m) =>
              m.offeringId === file.offeringId &&
              m.fileIds.includes(file.id) &&
              (membership.role === 'INSTRUCTOR' || m.status === 'PUBLISHED'),
          )
        )
          throw new ServiceError(403, 'The parent material is not available to your account.')
      }
      if (file.id === 701) return new Blob(['ELIO demo asset only.\n'], { type: 'text/plain' })
      const bytes = transientFiles.get(file.id)
      if (!bytes)
        throw new ServiceError(
          409,
          'File bytes are not persisted in the demo. Select the file again after reload.',
        )
      return bytes
    }),
}
