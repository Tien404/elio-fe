import { ServiceError } from '@/services/errors'
import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router'
import { services } from '@/services'
import { useAuth } from './auth-context'
import { useResource } from './use-resource'
export function useQuiz() {
  const { quizId, offeringId } = useParams(),
    id = Number(quizId),
    { identity } = useAuth(),
    load = useCallback(async () => {
      const view = await services.quiz.get(id)
      if (offeringId && view.quiz.offeringId !== Number(offeringId)) {
        throw new ServiceError(404, 'Quiz was not found in this course section.')
      }
      return view
    }, [id, offeringId])
  return useResource(load, `quiz:${identity!.me.account.id}:${offeringId ?? 'all'}:${id}`, {
    retainOnError: true,
  })
}
export function useAttempt() {
  const { attemptId, offeringId } = useParams(),
    id = Number(attemptId),
    { identity } = useAuth(),
    load = useCallback(async () => {
      const view = await services.quiz.attempt(id)
      if (offeringId && view.offeringId !== Number(offeringId)) {
        throw new ServiceError(404, 'Quiz attempt was not found in this course section.')
      }
      return view
    }, [id, offeringId]),
    result = useResource(load, `attempt:${identity!.me.account.id}:${offeringId ?? 'all'}:${id}`, {
      retainOnError: true,
    }),
    reload = result.reload
  useEffect(() => {
    const timer = window.setInterval(reload, 6000)
    return () => window.clearInterval(timer)
  }, [reload])
  return result
}
