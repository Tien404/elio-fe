import { useCallback, useEffect } from 'react'
import { useParams } from 'react-router'
import { services } from '@/services'
import { useAuth } from './auth-context'
import { useResource } from './use-resource'
export function useQuiz() {
  const id = Number(useParams().quizId),
    { identity } = useAuth(),
    load = useCallback(() => services.quiz.get(id), [id])
  return useResource(load, `quiz:${identity!.me.account.id}:${id}`, { retainOnError: true })
}
export function useAttempt() {
  const id = Number(useParams().attemptId),
    { identity } = useAuth(),
    load = useCallback(() => services.quiz.attempt(id), [id]),
    result = useResource(load, `attempt:${identity!.me.account.id}:${id}`, { retainOnError: true }),
    reload = result.reload
  useEffect(() => {
    const timer = window.setInterval(reload, 6000)
    return () => window.clearInterval(timer)
  }, [reload])
  return result
}
