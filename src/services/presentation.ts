import { services } from '@/services'
export function formatActivityReason(reason: string) {
  if (reason === 'No confirmed submission') return 'Awaiting submission.'
  if (reason === 'Confirmed submission') return 'Submitted.'
  if (reason === 'Attempt finalized') return 'Quiz completed.'
  if (reason === 'Marked complete') return 'Marked as completed.'
  if (reason === 'Not marked complete') return 'View the material and mark it as completed.'
  return reason
    .replace(
      'No confirmed submission; a missing-zero is incomplete',
      'Submit your assignment to complete this activity.',
    )
    .replace(
      'No valid submission for frozen recipients; check your group assignment',
      'Check your group and submit your assignment.',
    )
    .replace('Attempt not finalized', 'Complete and submit the quiz.')
    .replace(
      'Finalization failed; no completion or zero score',
      'Your quiz could not be processed. Contact your instructor.',
    )
    .replace('Attempt finalized; completion does not depend on score or release', 'Quiz completed.')
    .replace('Manually marked completed', 'Marked as completed.')
    .replace('Not marked completed', 'View the material and mark it as completed.')
    .replace('Valid confirmed version', 'Submitted version')
}
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
export function fileExtension(name: string): string {
  const parts = name.split('.')
  if (parts.length < 2) return 'FILE'
  const ext = parts[parts.length - 1].trim().toUpperCase()
  return ext.slice(0, 4) || 'FILE'
}
export function fileBadgeTone(ext: string): string {
  if (ext === 'PDF') return 'is-pdf'
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG'].includes(ext)) return 'is-image'
  if (['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(ext)) return 'is-archive'
  return ''
}
export function formatInstant(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
export function formatVietnamTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
export async function downloadFile(id: number, name: string) {
  const blob = await services.files.download(id),
    url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
