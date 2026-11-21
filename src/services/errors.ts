export class ServiceError extends Error {
  status: number
  fields: Record<string, string>
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message)
    this.name = 'ServiceError'
    this.status = status
    this.fields = fields
  }
}
export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export function mustReview(error: unknown) {
  return (
    error instanceof ServiceError &&
    ([0, 403, 412].includes(error.status) || error.fields.code === 'ACTIVE_LEAD_REQUIRED')
  )
}

export function requiresSessionRefresh(error: unknown) {
  return (
    error instanceof ServiceError &&
    ['CSRF_REJECTED', 'PASSWORD_CHANGE_REQUIRED'].includes(error.fields.code)
  )
}
