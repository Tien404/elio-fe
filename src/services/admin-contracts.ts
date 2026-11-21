import type { MeView, Role } from '@/services/contracts'
import type { Page } from '@/services/course-contracts'
import type { AdminQuery } from '@/services/personal-contracts'

export interface AdminAccount extends MeView {
  leadResponsibilities?: { id: number; title: string }[]
}

export interface CredentialDelivery {
  accountId: number
  temporaryPassword?: string
}

export interface OperationalAudit {
  key: string
  actorId: number
  actorName?: string
  action: string
  targetKind: string
  targetId: number | null
  occurredAt: string
  reason: string | null
}

export interface AdminService {
  accounts(query?: AdminQuery): Promise<Page<AdminAccount>>
  provision(input: {
    email: string
    displayName: string
    role: Role
    canCreateCourse: boolean
  }): Promise<CredentialDelivery>
  update(
    id: number,
    input: {
      status?: 'ACTIVE' | 'LOCKED'
      canCreateCourse?: boolean
      reason: string
      expectedVersion: number
    },
  ): Promise<MeView>
  resetPassword(id: number, reason: string, expectedVersion: number): Promise<CredentialDelivery>
  audit(query?: AdminQuery): Promise<Page<OperationalAudit>>
}
