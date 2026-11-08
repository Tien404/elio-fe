import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { Panel, DataTable, Status } from '@/components/ui'
import { LoadState, Pager, ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { QuizNav } from '@/components/quiz/QuizNav'
import { useQuiz } from '@/services/use-quiz'
import { useResource } from '@/services/use-resource'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
export function QuizAttempts() {
  const quiz = useQuiz(),
    view = quiz.data,
    { identity } = useAuth(),
    [page, setPage] = useState(1),
    id = view?.quiz.id ?? 0,
    load = useCallback(
      () => (id ? services.quiz.attempts(id, { page }) : Promise.resolve(null)),
      [id, page],
    ),
    result = useResource(load, `quiz-attempts:${identity!.me.account.id}:${id}:${page}`)
  return (
    <div className="course-workspace">
      <h1>Attempts and results</h1>
      <LoadState {...quiz} retry={quiz.reload} />
      {view && !quiz.error && (
        <>
          <QuizNav view={view} />
          <Panel title={view.quiz.title} icon="book-small">
            <LoadState {...result} retry={result.reload} />
            {result.data &&
              (result.data.items.length ? (
                <>
                  <DataTable
                    rows={result.data.items}
                    rowKey={(v) => v.attempt.id}
                    columns={[
                      {
                        label: 'Student',
                        render: (v) => `${v.student.displayName} · ${v.student.id}`,
                      },
                      { label: 'Attempt', render: (v) => v.attempt.id },
                      {
                        label: 'Status',
                        render: (v) =>
                          v.attempt.status === 'IN_PROGRESS'
                            ? 'In progress'
                            : v.finalization === 'ERROR'
                              ? 'Grading error · Not zero'
                              : v.finalization === 'PENDING'
                                ? 'Finalization pending'
                                : 'Finalized',
                      },
                      {
                        label: 'Result',
                        render: (v) =>
                          v.result.state === 'PUBLISHED'
                            ? `${v.result.score} / ${v.result.maxScore} · Published`
                            : v.result.state.replaceAll('_', ' ').toLowerCase(),
                      },
                      {
                        label: 'Actions',
                        render: (v) => (
                          <Link className="button secondary" to={`/quiz-attempts/${v.attempt.id}`}>
                            View attempt
                          </Link>
                        ),
                      },
                    ]}
                  />
                  <Pager value={result.data} change={setPage} />
                </>
              ) : (
                <Status>No attempts have started.</Status>
              ))}
            <Button
              icon="refresh"
              tone="secondary"
              onClick={() => {
                result.reload()
                quiz.reload()
              }}
            >
              Refresh attempts and eligible releases
            </Button>
          </Panel>
          <Panel title="Schedule locked" icon="info">
            <p>
              Schedule and duration lock from the first attempt. Results release automatically after
              close, successful finalization and an Open course section. Failed processing is
              unavailable, never a zero. Demo tools simulate the worker; no manual score override is
              available.
            </p>
          </Panel>
        </>
      )}
    </div>
  )
}
