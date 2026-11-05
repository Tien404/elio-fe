import { current } from './services'
import { getStore, commit, now } from './store'
import { nextId } from './policy'
import { scopedOfferings } from './projections'
import { ServiceError } from '@/services/errors'
export function prepareInboxScenarios() {
  const me = current().me.account,
    section = scopedOfferings()[0]
  if (!section)
    throw new ServiceError(409, 'Join or create a course section before adding inbox fixtures.')
  return commit(() => {
    const s = getStore(),
      fixtures = [
        ['Review fixture: course section', `/offerings/${section.id}`],
        ['Review fixture: inaccessible destination', '/assignments/999999'],
        ['Review fixture: unsafe destination', 'https://example.invalid/blocked'],
      ]
    for (const [title, targetUri] of fixtures)
      if (!s.workspace.recipientEvents.some((e) => e.recipientId === me.id && e.title === title))
        s.workspace.recipientEvents.push({
          id: nextId(s.workspace.recipientEvents),
          offeringId: section.id,
          recipientId: me.id,
          title,
          targetUri,
          occurredAt: new Date(now()).toISOString(),
        })
    return 'Inbox review fixtures are available for this demo account.'
  })
}
