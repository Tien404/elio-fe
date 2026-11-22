import { OwnQuizResults } from './OwnQuizResults'
import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable, PageHeader, Panel, Status } from '@/components/ui'
import { LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { getPublishedAssignmentResults } from '@/services'
import { useAuth } from '@/services/auth-context'
import { formatInstant } from '@/services/presentation'
import { useResource } from '@/services/use-resource'

export function PublishedAssignmentResults({ offeringId }: { offeringId?: number }) {
  const { identity } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const load = useCallback(
    () => getPublishedAssignmentResults(offeringId, { page }),
    [offeringId, page],
  )
  const result = useResource(
    load,
    `published-results:${identity!.me.account.id}:${offeringId}:${page}`,
  )
  return (
    <div className="course-workspace">
      {offeringId && <Link to="/results">All course results</Link>}
      <PageHeader title="My results" />
      <Panel title="Published assignment results" icon="results">
        <LoadState {...result} retry={result.reload} />
        {result.data &&
          (result.data.items.length ? (
            <>
              <DataTable
                rows={result.data.items}
                rowKey={(row) => row.assignmentId}
                columns={[
                  {
                    label: 'Assignment',
                    render: (row) => (
                      <>
                        <Link to={`/offerings/${row.offeringId}/assignments/${row.assignmentId}`}>
                          {row.title}
                        </Link>
                        <small className="cell-detail">
                          {row.groupId === null ? 'Individual' : 'Group'}
                        </small>
                      </>
                    ),
                  },
                  {
                    label: 'Score',
                    render: (row) =>
                      row.revision.specialMark
                        ? row.revision.specialMark === 'ABSENT'
                          ? '11 · Absent'
                          : '12 · Banned'
                        : `${row.revision.score} / ${row.maxScore}`,
                  },
                  {
                    label: 'Published',
                    render: (row) =>
                      `${formatInstant(row.publishedAt)} · Revision ${row.revision.revisionNo}`,
                  },
                  {
                    label: 'Feedback',
                    render: (row) => (
                      <>
                        {row.revision.feedback || 'No feedback.'}
                        {row.revision.isMissingZero && (
                          <small className="cell-detail">
                            Not submitted · {row.revision.zeroReason}
                          </small>
                        )}
                      </>
                    ),
                  },
                ]}
              />
              <Pager
                value={result.data}
                change={(next) =>
                  setParams((current) => {
                    current.set('page', String(next))
                    return current
                  })
                }
              />
            </>
          ) : (
            <Status>No assignment grades have been published.</Status>
          ))}
      </Panel>
      <OwnQuizResults offeringId={offeringId} />
    </div>
  )
}
