import type { CalendarItem } from '@/services/contracts'
import { services } from '@/services'

export const calendarKindLabel: Record<CalendarItem['kind'], string> = {
  ASSIGNMENT_DUE: 'Assignment due',
  QUIZ_OPEN: 'Quiz opens',
  QUIZ_CLOSE: 'Quiz closes',
}

export function calendarDate(value: string | Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function calendarMonthRange(date: string) {
  const month = date.slice(0, 7)
  const end = new Date(`${month}-01T00:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  return { from: `${month}-01`, to: end.toISOString().slice(0, 10) }
}

export function shiftCalendarMonth(date: string, delta: number) {
  const current = new Date(`${date}T00:00:00Z`)
  const next = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1))
  const last = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  next.setUTCDate(Math.min(current.getUTCDate(), last))
  return next.toISOString().slice(0, 10)
}

export async function loadCalendarMonth(date: string, kind: string, offeringId?: number) {
  const query = { ...calendarMonthRange(date), kind, offeringId, pageSize: 100 }
  const first = await services.personal.calendar({ ...query, page: 1 })
  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page++)
    items.push(...(await services.personal.calendar({ ...query, page })).items)
  return { ...first, items }
}
