export function vietnamInput(utc: string) {
  return new Date(Date.parse(utc) + 7 * 3600000).toISOString().slice(0, 16)
}
export function utcInput(local: string) {
  return local ? new Date(`${local}+07:00`).toISOString() : ''
}

export function vietnamDayBoundary(date: string, after = false) {
  const day = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return null
  if (after) day.setUTCDate(day.getUTCDate() + 1)
  return `${day.toISOString().slice(0, 10)}T00:00:00+07:00`
}
