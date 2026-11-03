import { personalState } from '@/mocks/personal-state'
import { quizState } from '@/mocks/quiz-state'
import { assessmentState } from '@/mocks/assessment-state'
import { workspaceState } from '@/mocks/workspace-state'
import { seed, type DemoStore } from '@/mocks/seed'
import { ServiceError } from '@/services/errors'

export const STORE_KEY = 'elio.demo.v1'
export const transientFiles = new Map<number, Blob>()
let store: DemoStore | undefined
export function getStore(): DemoStore {
  if (store) return store
  const raw = localStorage.getItem(STORE_KEY)
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw) as DemoStore
      if (
        parsed.schemaVersion !== 1 ||
        ![
          'accounts',
          'offerings',
          'memberships',
          'materials',
          'assignments',
          'groups',
          'submissions',
          'receipts',
          'files',
          'grades',
          'quizzes',
        ].every((key) => Array.isArray((parsed as unknown as Record<string, unknown>)[key])) ||
        !Number.isFinite(parsed.clockOffset) ||
        !parsed.passwordVerifiers ||
        !parsed.accounts.every(
          (a) =>
            a.account.id > 0 &&
            typeof a.account.displayName === 'string' &&
            typeof a.email === 'string' &&
            a.version > 0,
        )
      )
        throw new Error()
      store = parsed
      if (!store.personal) {
        store.personal = personalState()
        persist()
      }
      if (!store.quizEngine) {
        store.quizEngine = quizState(store.quizzes)
        persist()
      }
      if (!store.assessment) {
        store.assessment = assessmentState(store)
        persist()
      }
      if (!store.workspace) {
        store.workspace = workspaceState(store)
        persist()
      }
    } catch {
      throw new ServiceError(
        409,
        'Demo data cannot be read. Use Reset demo to explicitly replace this demo store.',
      )
    }
  } else {
    store = seed()
    persist()
  }
  return store!
}
export function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store))
  } catch {
    store = undefined
    throw new ServiceError(507, 'Demo storage is unavailable or full. Changes cannot be saved.')
  }
}
export function reloadStore() {
  store = undefined
}
export function now() {
  return Date.now() + getStore().clockOffset
}
export function resetStore() {
  if (typeof sessionStorage !== 'undefined')
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith('elio.review.') || key?.startsWith('elio.quiz.choices.'))
        sessionStorage.removeItem(key)
    }
  transientFiles.clear()
  store = seed()
  persist()
  window.dispatchEvent(new Event('elio:session'))
}
export function advanceClock(hours: number) {
  getStore().clockOffset += hours * 3_600_000
  persist()
  window.dispatchEvent(new Event('elio:session'))
  window.dispatchEvent(new Event('elio:data'))
}

export function commit<T>(operation: () => T): T {
  const before = structuredClone(getStore())
  try {
    const result = operation()
    persist()
    window.dispatchEvent(new Event('elio:data'))
    return result
  } catch (error) {
    store = before
    throw error
  }
}
