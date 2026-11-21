import { useParams } from 'react-router'

export function useOfferingRoute() {
  const offeringId = Number(useParams().offeringId) || undefined
  return {
    offeringId,
    prefix: offeringId ? `/offerings/${offeringId}` : '',
  }
}
