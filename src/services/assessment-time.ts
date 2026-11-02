export function vietnamInput(utc: string) {
  return new Date(Date.parse(utc) + 7 * 3600000).toISOString().slice(0, 16)
}
export function utcInput(local: string) {
  return local ? new Date(`${local}+07:00`).toISOString() : ''
}
