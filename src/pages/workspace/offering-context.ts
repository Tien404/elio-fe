import { useOutletContext } from 'react-router'
import type { OfferingView } from '@/services/course-contracts'
export function useOffering() {
  return useOutletContext<{ view: OfferingView; refreshing: boolean; reload(): void }>()
}
