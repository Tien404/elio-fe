import { useOfferingRoute } from '@/services/use-offering-route'
import { Link, NavLink } from 'react-router'
import { Icon } from '@/components/ui'
import type { QuizView } from '@/services/quiz-contracts'
export function QuizNav({ view }: { view: QuizView }) {
  const { prefix } = useOfferingRoute()
  return (
    <>
      <div className="breadcrumb">
        <Link to={`/offerings/${view.quiz.offeringId}`}>{view.offeringLabel}</Link> /{' '}
        <Link to={`${prefix}/quizzes`}>Quizzes</Link> / {view.quiz.title}
      </div>
      <nav className="section-tabs" aria-label="Quiz navigation">
        <NavLink end to={`${prefix}/quizzes/${view.quiz.id}`}>
          <Icon name="quizzes" size={18} inheritColor />
          Quiz details
        </NavLink>
        {view.teacher && (
          <NavLink to={`${prefix}/quizzes/${view.quiz.id}/attempts`}>
            <Icon name="results" size={18} inheritColor />
            Attempts and results
          </NavLink>
        )}
      </nav>
    </>
  )
}
