import { commit, getStore, now } from '@/mocks/store'
import { nextId } from '@/mocks/policy'
import type { MeView } from '@/services/contracts'

export function prepareCourseScenarios() {
  return commit(() => {
    const s = getStore()
    function person(email: string, displayName: string, status: 'ACTIVE' | 'LOCKED') {
      let p = s.accounts.find((a) => a.email === email)
      if (!p) {
        p = {
          email,
          account: {
            id: nextId(s.accounts.map((a) => a.account)),
            displayName,
            role: 'INSTRUCTOR',
            status,
            mustChangePassword: false,
          },
          canCreateCourse: false,
          version: 1,
        } satisfies MeView
        s.accounts.push(p)
      }
      return p.account
    }
    const locked = person('recovery.lead@demo.elio.test', 'Morgan Wells', 'LOCKED')
    person('instructor@demo.elio.test', 'Drew Parker', 'ACTIVE')
    const active = s.accounts.find(
      (a) => a.account.role === 'INSTRUCTOR' && a.account.status === 'ACTIVE',
    )!.account
    let catalog = s.workspace.catalog.find((c) => c.courseCode === 'DEMO-OPS')
    if (!catalog) {
      catalog = {
        id: nextId(s.workspace.catalog),
        courseCode: 'DEMO-OPS',
        courseName: 'Workspace governance lab',
        credits: 1,
      }
      s.workspace.catalog.push(catalog)
    }
    for (const section of ['RECOVERY', 'ACTIVE-ATTEMPT', 'FINALIZE-ERROR']) {
      if (s.offerings.some((o) => o.courseId === catalog.id && o.sectionCode === section)) continue
      const id = nextId(s.offerings),
        membershipId = nextId(s.memberships),
        lead = section === 'RECOVERY' ? locked : active
      s.offerings.push({
        id,
        courseId: catalog.id,
        courseCode: catalog.courseCode,
        title: `Governance lab · ${section.toLowerCase()}`,
        semester: 'DEMO',
        sectionCode: section,
        status: section === 'RECOVERY' ? 'ARCHIVED' : 'OPEN',
        leadMembershipId: membershipId,
        version: 1,
      })
      s.memberships.push({
        id: membershipId,
        offeringId: id,
        account: { ...lead },
        role: 'INSTRUCTOR',
        teachingRole: 'LEAD',
        status: 'ACTIVE',
        version: 1,
      })
      const code = id.toString(36).toUpperCase().padStart(6, '0')
      s.workspace.details[id] = {
        learningInformation: 'Mock governance review scenario.',
        joinCode: code,
        joinEnabled: true,
      }
      s.workspace.usedCodes.push(code)
      if (section !== 'RECOVERY')
        s.workspace.attemptGuards.push({
          id: nextId(s.workspace.attemptGuards),
          offeringId: id,
          endAt: new Date(
            now() + (section === 'ACTIVE-ATTEMPT' ? 3_600_000 : -3_600_000),
          ).toISOString(),
          finalization: section === 'ACTIVE-ATTEMPT' ? 'PENDING' : 'ERROR',
        })
    }
    return s.offerings
      .filter((o) => o.courseId === catalog.id)
      .map((o) => ({ id: o.id, title: o.title }))
  })
}
export function finalizeExpiredDemoAttempts() {
  return commit(() => {
    const items = getStore().workspace.attemptGuards.filter(
      (a) => Date.parse(a.endAt) <= now() && a.finalization !== 'SUCCEEDED',
    )
    items.forEach((a) => {
      a.finalization = 'SUCCEEDED'
    })
    return items.length
  })
}
