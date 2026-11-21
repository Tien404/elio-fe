import type { Identity } from '@/services/contracts'
import { ServiceError } from '@/services/errors'

let identity: Identity | null = null
export const currentIdentity = () => identity
export function acceptIdentity(value: Identity | null) {
  identity = value
}
export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD'].includes(method) && identity)
    headers.set('X-CSRF-Token', identity.session.csrfToken)
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      ...init,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    throw new ServiceError(
      0,
      method === 'GET'
        ? 'Cannot reach the server. Check your connection.'
        : 'The response was lost. Reload the current record before sending another command.',
    )
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as {
      detail?: string
      code?: string
      currentVersion?: number
    } | null
    if (response.status === 401 && identity) {
      identity = null
      window.dispatchEvent(new Event('elio:expired'))
    }
    if (response.status === 412) window.dispatchEvent(new Event('elio:data'))
    throw new ServiceError(
      response.status,
      response.status === 501
        ? 'This feature is unavailable.'
        : (problem?.detail ?? `Request failed (${response.status}).`),
      {
        ...(problem?.code ? { code: problem.code } : {}),
        ...(problem?.currentVersion !== undefined
          ? { currentVersion: String(problem.currentVersion) }
          : {}),
      },
    )
  }
  if (!['GET', 'HEAD'].includes(method)) window.dispatchEvent(new Event('elio:data'))
  if (response.status === 204) return undefined as T
  if (['application/octet-stream', 'text/csv'].includes(headers.get('Accept') ?? ''))
    return response.blob() as Promise<T>
  return response.json() as Promise<T>
}
export const json = (method: string, body: unknown, version?: number): RequestInit => ({
  method,
  body: JSON.stringify(body),
  headers: version === undefined ? {} : { 'If-Match': `"${version}"` },
})
export async function unsupported(): Promise<never> {
  throw new ServiceError(501, 'This feature is unavailable.')
}
