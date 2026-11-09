import { useCallback, useState } from 'react'
import { Panel } from '@/components/ui'
import { ActionButton, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { FileList } from './Files'
import { getMvpSubmissions, getMvpSubmissionHistory } from '@/services'
import { useResource } from '@/services/use-resource'
import { formatInstant } from '@/services/presentation'
export function MvpSubmissionReview({ id }: { id: number }) {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(0)
  const load = useCallback(() => getMvpSubmissions(id, page), [id, page])
  const list = useResource(load, `mvp-submissions:${id}:${page}`)
  const historyLoad = useCallback(
    () => (selected ? getMvpSubmissionHistory(selected) : Promise.resolve(null)),
    [selected],
  )
  const detail = useResource(historyLoad, `mvp-history:${selected}`)
  return (
    <Panel title="Student submissions" icon="document-small">
      <LoadState {...list} retry={list.reload} />
      {list.data && (
        <>
          {!list.data.items.length && <p>No submissions yet.</p>}
          {list.data.items.map((s) => (
            <p key={s.id}>
              Student {s.subjectId} · Version {s.version} ·{' '}
              {s.currentVersion?.isLate ? 'Late' : 'On time'}{' '}
              <ActionButton tone="secondary" onClick={() => setSelected(s.id)}>
                View files and history
              </ActionButton>
            </p>
          ))}
          <Pager value={list.data} change={setPage} />
        </>
      )}
      <LoadState {...detail} retry={detail.reload} />
      {detail.data?.history.map((v) => (
        <details key={v.versionNo}>
          <summary>
            Version {v.versionNo} · {formatInstant(v.submittedAt)} · {v.receiptCode}
          </summary>
          <FileList files={detail.data!.files.filter((f) => v.fileIds.includes(f.id))} />
        </details>
      ))}
    </Panel>
  )
}
