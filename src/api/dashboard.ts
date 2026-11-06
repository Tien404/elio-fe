import type { Offering, Role } from '@/services/contracts'
import { http } from './http'
export interface DashboardData {
  serverNow: string
  role: Role
  counts: Record<string, number | null>
  sections: Offering[]
  assignments: {
    id: number
    offeringId: number
    title: string
    dueAt: string
    cutoffAt: string
    submitted: boolean
  }[]
}
export const getDashboard = () => http<DashboardData>('/dashboard')
