import { useCallback, useId, useState } from 'react'
import { Field } from '@/components/ui'
import { LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import type { AccountSummary } from '@/services/contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'

export function AccountPicker({
  offeringId,
  role,
  selected,
  change,
  error,
}: {
  offeringId: number
  role: 'STUDENT' | 'INSTRUCTOR'
  selected: AccountSummary | null
  error?: string
  change(value: AccountSummary | null): void
}) {
  const errorId = useId()
  const [search, setSearch] = useState(''),
    [page, setPage] = useState(1)
  const load = useCallback(
    () => services.courses.candidates(offeringId, role, { search, page }),
    [offeringId, role, search, page],
  )
  const result = useResource(load, `candidates:${offeringId}:${role}:${search}:${page}`)
  return (
    <>
      <Field
        label="Search existing accounts"
        maxLength={role === 'INSTRUCTOR' ? 100 : undefined}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
      />
      <LoadState {...result} retry={result.reload} />
      <Select
        label="Existing account"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        required
        value={selected?.id ?? ''}
        onChange={(e) =>
          change(result.data?.items.find((a) => a.id === Number(e.target.value)) ?? null)
        }
      >
        <option value="">Select an eligible account</option>
        {selected && !result.data?.items.some((a) => a.id === selected.id) && (
          <option value={selected.id}>
            {selected.displayName} · {selected.id} · Selected
          </option>
        )}
        {result.data?.items.map((a) => (
          <option key={a.id} value={a.id}>
            {a.displayName} · {a.id} · {a.status.toLowerCase()}
          </option>
        ))}
      </Select>
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {result.data && (
        <>
          <Pager value={result.data} change={setPage} />
          {!result.data.totalItems && (
            <p className="form-description">
              No eligible active accounts match. Existing active members are excluded.
            </p>
          )}
        </>
      )}
    </>
  )
}
