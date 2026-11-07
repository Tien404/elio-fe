import { useState } from 'react'
import { Link } from 'react-router'
import { DataTable, Status } from '@/components/ui'
import { Pager } from '@/components/workspace/WorkspaceUI'
import type { ResultRow } from '@/services/assessment-contracts'
export function OwnResultsTable({ row, activityId }: { row: ResultRow; activityId?: number }) {
  const [page, setPage] = useState(1),
    cells = row.cells.filter((c) => !activityId || c.activityId === activityId),
    totalPages = Math.ceil(cells.length / 25)
  return cells.length ? (
    <>
      <DataTable
        rows={cells.slice((page - 1) * 25, page * 25)}
        rowKey={(c) => `${c.kind}:${c.activityId}`}
        columns={[
          {
            label: 'Activity',
            render: (c) =>
              c.kind === 'ASSIGNMENT' ? (
                <Link to={`/assignments/${c.activityId}`}>{c.title}</Link>
              ) : (
                <Link to={`/quizzes/${c.activityId}`}>{c.title}</Link>
              ),
          },
          { label: 'Weight', render: (c) => `${c.weight}%` },
          {
            label: 'Score',
            render: (c) => (c.score === null ? 'Unavailable' : `${c.score} / ${c.maxScore}`),
          },
          {
            label: 'Contribution',
            render: (c) => (c.contribution === null ? 'Unavailable' : `${c.contribution} / 10`),
          },
          {
            label: 'Status',
            render: (c) => (
              <>
                {c.state}
                <small>{c.complete ? 'Activity completed' : 'Activity not completed'}</small>
              </>
            ),
          },
        ]}
      />
      <Pager
        value={{ page, pageSize: 25, totalItems: cells.length, totalPages }}
        change={setPage}
      />
    </>
  ) : (
    <Status>No applicable activities.</Status>
  )
}
