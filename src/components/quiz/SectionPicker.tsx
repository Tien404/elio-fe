import { useCallback, useState } from 'react'
import { Field, Status } from '@/components/ui'
import { Select, Pager, LoadState } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
export function SectionPicker({
  value,
  change,
  all = false,
}: {
  value: number
  change(id: number): void
  all?: boolean
}) {
  const { identity } = useAuth(),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    load = useCallback(() => services.courses.list({ page, search }), [page, search]),
    result = useResource(load, `quiz-sections:${identity!.me.account.id}:${page}:${search}`)
  return (
    <div className="quiz-scope">
      <Select
        label="Course section"
        value={value || ''}
        onChange={(e) => change(Number(e.target.value) || 0)}
      >
        <option value="">{all ? 'All course sections' : 'Select course section'}</option>
        {value > 0 && !result.data?.items.some((v) => v.offering.id === value) && (
          <option value={value}>Selected section · {value}</option>
        )}
        {result.data?.items
          .filter((v) => v.permissions.academic)
          .map((v) => (
            <option key={v.offering.id} value={v.offering.id}>
              {v.offering.courseCode} · {v.offering.sectionCode} · {v.offering.semester}
              {v.offering.status === 'ARCHIVED' ? ' · Archived' : ''}
            </option>
          ))}
      </Select>
      <LoadState {...result} retry={result.reload} />
      {(search || (result.data && result.data.totalPages > 1)) && (
        <details className="scope-search">
          <summary>Find more course sections</summary>
          <Field
            label="Find course sections"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
          {result.data && <Pager value={result.data} change={setPage} />}
        </details>
      )}
      {result.data && !result.data.items.length && (
        <Status>No course sections match this search.</Status>
      )}
    </div>
  )
}
