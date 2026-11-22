import type { CalendarItem, Offering, Role } from '@/services/contracts'
import type { DashboardTask, DashboardView, ProgressRow } from '@/services/personal-contracts'
import { http } from './http'

interface DashboardDto {
  serverNow: string
  role: Role
  counts: Record<string, number | null>
  sections: Offering[]
  upcoming: CalendarItem[]
  progress: ProgressRow[]
  tasks: DashboardTask[]
  announcements: { id: number; offeringId: number; title: string; href: string }[]
  unread: number
}

export async function getDashboard(): Promise<DashboardView> {
  const { counts, ...view } = await http<DashboardDto>('/dashboard')
  const completed = view.progress.reduce((sum, row) => sum + row.completed, 0)
  const total = view.progress.reduce((sum, row) => sum + row.total, 0)
  const metrics =
    view.role === 'ADMIN'
      ? [
          counts.accounts,
          counts.lockedAccounts,
          counts.openSections,
          counts.pendingRegistrations,
          counts.archivedLeadRepairs,
        ]
      : [
          counts.openSections,
          counts.missingSubmissions,
          counts.pendingQuizzes,
          total ? Math.round((100 * completed) / total) : null,
        ]
  return {
    ...view,
    metrics: metrics.map((value) => value ?? null),
    announcements: view.announcements.map((item) => ({
      ...item,
      href: `${item.href}?announcementId=${item.id}`,
    })),
  }
}
