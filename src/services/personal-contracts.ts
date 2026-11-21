import type { CalendarItem, Offering, Role } from '@/services/contracts'
import type { Page, PageQuery } from '@/services/course-contracts'
export interface PersonalQuery extends PageQuery {
  offeringId?: number
  state?: string
  kind?: string
  from?: string
  to?: string
}
export interface AdminQuery extends PageQuery {
  actorId?: number
  offeringId?: number
  fromAt?: string
  toAt?: string
  targetType?: string
  role?: string
  status?: string
  action?: string
}
export interface Notification {
  id: number
  offeringId: number | null
  targetKind: string
  targetId: number
  event?: string
  href: string | null
  preview: string
  status: 'UNREAD' | 'READ'
  createdAt: string
}

export interface ProgressItem {
  id: string
  kind: string
  title: string
  complete: boolean
  reason: string
  href: string
}

export interface ProgressRow {
  offeringId: number
  membershipId: number
  studentId: number
  displayName: string
  completed: number
  total: number
  percent: number | null
  notice?: 'NO_MANDATORY_ACTIVITIES' | null
  items: ProgressItem[]
}

export interface ProgressView {
  teacher: boolean
  rows: Page<ProgressRow>
}

export interface DashboardTask {
  id: string
  title: string
  detail: string
  href: string
  kind?: string
  at?: string | null
}

export interface DashboardView {
  role: Role
  serverNow: string
  sections: Offering[]
  metrics: (number | null)[]
  progress: ProgressRow[]
  tasks: DashboardTask[]
  upcoming: CalendarItem[]
  announcements: { id: number; title: string; href: string }[]
  unread: number
}

export interface InboxView {
  unread: number
  rows: Page<Notification>
}

export interface PersonalService {
  summary(): Promise<{ unread: number; semesters: string[] }>
  dashboard(): Promise<DashboardView>
  inbox(query?: PersonalQuery): Promise<InboxView>
  read(id: number): Promise<void>
  destination(notification: Notification): Promise<{ href: string | null }>
  calendar(query?: PersonalQuery): Promise<Page<CalendarItem> & { serverNow: string }>
  progress(offeringId: number, query?: PersonalQuery): Promise<ProgressView>
  ownProgress(query?: PageQuery): Promise<ProgressView>
}
