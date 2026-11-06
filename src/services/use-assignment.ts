import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
export function useAssignment() {
  const id = Number(useParams().assignmentId),
    { identity } = useAuth(),
    load = useCallback(() => services.assessment.get(id), [id])
  const result = useResource(load, `assignment:${identity!.me.account.id}:${id}`, {
    retainOnError: true,
  })
  const reload = result.reload
  useEffect(() => {
    const interval = window.setInterval(reload, 30000)
    return () => window.clearInterval(interval)
  }, [reload])
  return result
}
