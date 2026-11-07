import { downloadFile, formatFileSize } from '@/services/presentation'
import { Panel } from '@/components/ui'
import { ActionButton, Badge, Feedback } from '@/components/workspace/WorkspaceUI'
import type { MaterialView, OfferingView } from '@/services/course-contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'

export function MaterialReader({ item, offering }: { item: MaterialView; offering: OfferingView }) {
  const action = useAction(),
    { identity } = useAuth(),
    r = item.resource
  const safeLink = r.externalUrl && /^https?:\/\//i.test(r.externalUrl) ? r.externalUrl : null
  return (
    <Panel title={r.title} icon="document-small">
      <div className="actions">
        <Badge value={r.status} />
        <span>
          {item.mandatory ? 'Mandatory' : 'Optional'} · {r.kind.toLowerCase()}
        </span>
      </div>
      <Feedback action={action} />
      <div className="material-body">
        {r.kind === 'TEXT' ? (
          <p>{r.body}</p>
        ) : r.kind === 'LINK' ? (
          safeLink ? (
            <a href={safeLink} target="_blank" rel="noopener noreferrer">
              Open learning link
            </a>
          ) : (
            <p>Link unavailable.</p>
          )
        ) : (
          item.files.map((file) => (
            <div key={file.id}>
              <p>
                {file.originalName} · {formatFileSize(file.byteSize)}
              </p>
              <ActionButton
                icon="download-white"
                disabled={action.pending}
                onClick={() => void action.run(() => downloadFile(file.id, file.originalName))}
              >
                {action.pending ? 'Preparing download…' : 'Download file'}
              </ActionButton>
            </div>
          ))
        )}
      </div>
      {identity!.me.account.role === 'STUDENT' && (
        <ActionButton
          icon="complete-white"
          disabled={action.pending || offering.offering.status !== 'OPEN'}
          onClick={() =>
            void action.run(
              () =>
                item.completed
                  ? services.content.uncompleteMaterial(r.id)
                  : services.content.completeMaterial(r.id),
              undefined,
              item.completed
                ? 'Material marked as not completed.'
                : 'Material marked as completed.',
            )
          }
        >
          {item.completed
            ? 'Mark as not completed'
            : action.pending
              ? 'Saving completion…'
              : 'Mark as completed'}
        </ActionButton>
      )}
    </Panel>
  )
}
