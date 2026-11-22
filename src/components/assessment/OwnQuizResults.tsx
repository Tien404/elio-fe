import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable, Panel, Status } from '@/components/ui'
import { ActionButton, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { getOwnQuizResults } from '@/services'
import { useAuth } from '@/services/auth-context'
import { formatInstant } from '@/services/presentation'
import { quizResultStatus } from '@/services/quiz-status'
import { useResource } from '@/services/use-resource'

export function OwnQuizResults({ offeringId }: { offeringId?: number }) {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('quizPage')) || 1)
  const load = useCallback(() => getOwnQuizResults(offeringId, { page }), [offeringId, page])
  const result = useResource(
    load,
    `own-quiz-results:${identity!.me.account.id}:${offeringId}:${page}`,
  )
  return (
    <Panel
      title="Quiz results"
      icon="quizzes"
      actions={
        <ActionButton
          tone="secondary"
          icon="refresh"
          disabled={result.loading}
          onClick={result.reload}
        >
          Refresh quiz results
        </ActionButton>
      }
    >
      <LoadState {...result} retry={result.reload} />
      {result.data &&
        (result.data.items.length ? (
          <>
            <DataTable
              rows={result.data.items}
              rowKey={(row) => row.attempt.id}
              columns={[
                {
                  label: 'Quiz',
                  render: (row) => (
                    <Link to={`/offerings/${row.offeringId}/quizzes/attempts/${row.attempt.id}`}>
                      {row.quizTitle}
                    </Link>
                  ),
                },
                {
                  label: 'Status',
                  render: (row) =>
                    row.attempt.status === 'IN_PROGRESS'
                      ? 'In progress'
                      : quizResultStatus[row.result.state],
                },
                {
                  label: 'Score',
                  render: (row) =>
                    row.result.state === 'PUBLISHED'
                      ? `${row.result.score} / ${row.result.maxScore}`
                      : '—',
                },
                {
                  label: 'Released',
                  render: (row) =>
                    row.result.state === 'PUBLISHED' ? formatInstant(row.result.releasedAt) : '—',
                },
              ]}
            />
            <Pager
              value={result.data}
              change={(next) =>
                setParams((current) => {
                  current.set('quizPage', String(next))
                  return current
                })
              }
            />
          </>
        ) : (
          <Status>No quiz attempts yet.</Status>
        ))}
    </Panel>
  )
}
