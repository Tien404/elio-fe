import type { PageQuery } from '@/services/course-contracts'
export interface PersonalQuery extends PageQuery {
  offeringId?: number
  state?: string
  kind?: string
  from?: string
  to?: string
}
export interface AdminQuery extends PageQuery {
  role?: string
  status?: string
  action?: string
}
export interface Notification {
  id: number
  offeringId: number | null
  targetKind: string
  targetId: number
  preview: string
  status: 'UNREAD' | 'READ'
  createdAt: string
}
