export function personalState() {
  return {
    read: [] as { recipientId: number; notificationId: number }[],
    audits: [] as {
      id: number
      actorId: number
      action: string
      targetKind?: string
      targetId: number
      reason: string
      occurredAt: string
    }[],
  }
}
