import { reconcileQuizClock } from '@/mocks/quiz-runtime'
import { getStore, persist, reloadStore } from '@/mocks/store'
import { ServiceError } from '@/services/errors'
export const presets = [
  'normal',
  'empty',
  'network',
  '400',
  '401',
  '403',
  '404',
  '409',
  '412',
  '422',
] as const
export type Preset = (typeof presets)[number]
let next: Preset = 'normal'
let latency = 350
let queue: Promise<unknown> = Promise.resolve()
export const scenarios = {
  set(preset: Preset) {
    next = preset
  },
  setLatency(ms: number) {
    latency = ms
  },
  reset() {
    next = 'normal'
    latency = 350
  },
}
export async function request<T>(operation: (preset: Preset) => T | Promise<T>): Promise<T> {
  const preset = next
  next = 'normal'
  await new Promise((resolve) => setTimeout(resolve, latency))
  const run = async () => {
    reloadStore()
    if (preset === 'network')
      throw new ServiceError(
        0,
        'Network unavailable. Your input has been kept. Try again when ready.',
      )
    if (/^\d+$/.test(preset)) {
      const status = Number(preset)
      if (status === 401) {
        getStore().session = null
        persist()
        window.dispatchEvent(new Event('elio:expired'))
      }
      const messages: Record<number, string> = {
        400: 'Request rejected. Review your input.',
        401: 'Your session has expired. Sign in again.',
        403: 'Permission lost. This action is no longer allowed.',
        404: 'This resource is no longer available.',
        409: 'A conflicting change was detected. Review the saved data before trying again.',
        412: 'This version is stale. Review the latest saved data before trying again.',
        422: 'Validation failed. Review the highlighted fields.',
      }
      throw new ServiceError(status, messages[status])
    }
    reconcileQuizClock()
    return structuredClone(await operation(preset))
  }
  if (typeof navigator !== 'undefined' && navigator.locks)
    return navigator.locks.request('elio.demo.v1.service', run)
  const pending = queue.then(run, run)
  queue = pending.then(
    () => undefined,
    () => undefined,
  )
  return pending
}
