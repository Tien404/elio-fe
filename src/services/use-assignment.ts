import { ServiceError } from '@/services/errors'
import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
export function useAssignment() {
  const { assignmentId, offeringId } = useParams(),
    id = Number(assignmentId),
    { identity } = useAuth(),
    load = useCallback(async () => {
      const view = await services.assessment.get(id)
      if (offeringId && view.assignment.offeringId !== Number(offeringId)) {
        throw new ServiceError(404, 'Assignment was not found in this course section.')
      }
      return view
    }, [id, offeringId])
  const result = useResource(
    load,
    `assignment:${identity!.me.account.id}:${offeringId ?? 'all'}:${id}`,
    {
      retainOnError: true,
    },
  )
  const reload = result.reload
  useEffect(() => {
    const interval = window.setInterval(reload, 30000)
    return () => window.clearInterval(interval)
  }, [reload])
  return result
}
