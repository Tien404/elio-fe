import { Link, NavLink } from 'react-router'
import { Icon } from '@/components/ui'
import type { QuizView } from '@/services/quiz-contracts'
export function QuizNav({ view }: { view: QuizView }) {
  return (
    <>
      <div className="breadcrumb">
        <Link to={`/offerings/${view.quiz.offeringId}`}>{view.offeringLabel}</Link> /{' '}
        <Link to="/quizzes">Quizzes</Link> / {view.quiz.title}
      </div>
      <nav className="section-tabs" aria-label="Quiz navigation">
        <NavLink end to={`/quizzes/${view.quiz.id}`}>
          <Icon name="quizzes" size={18} inheritColor />
          Quiz details
        </NavLink>
        {view.teacher && (
          <>
            <NavLink to={`/quizzes/${view.quiz.id}/attempts`}>
              <Icon name="results" size={18} inheritColor />
              Attempts and results
            </NavLink>
            <NavLink to={`/question-bank?offeringId=${view.quiz.offeringId}`}>
              Question bank
            </NavLink>
          </>
        )}
        <NavLink to={`/results?offeringId=${view.quiz.offeringId}`}>
          {view.teacher ? 'Gradebook' : 'My results'}
        </NavLink>
      </nav>
    </>
  )
}
