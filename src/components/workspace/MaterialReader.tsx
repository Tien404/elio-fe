import { downloadFile, fileBadgeTone, fileExtension, formatFileSize } from '@/services/presentation'
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
  const isStudent = identity!.me.account.role === 'STUDENT'
  return (
    <Panel
      title={r.title}
      icon="document-small"
      actions={
        isStudent ? (
          <ActionButton
            icon={item.completed ? 'check' : 'complete-white'}
            tone={item.completed ? 'secondary' : 'primary'}
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
        ) : undefined
      }
    >
      <p className="activity-meta">
        {r.status !== 'PUBLISHED' && (
          <>
            <Badge value={r.status} /> ·{' '}
          </>
        )}
        {item.mandatory ? 'Mandatory' : 'Optional'} · {r.kind.toLowerCase()}
      </p>
      <Feedback action={action} />
      <div className="material-reader-content">
        {r.kind === 'TEXT' ? (
          <div className="material-body">
            <p>{r.body}</p>
          </div>
        ) : r.kind === 'LINK' ? (
          safeLink ? (
            <div className="upload-file-card">
              <span className="upload-file-badge is-image" aria-hidden="true">
                URL
              </span>
              <div className="upload-file-info">
                <strong className="upload-file-name">{safeLink}</strong>
                <div className="upload-file-meta">
                  <span>External learning link</span>
                </div>
              </div>
              <div className="actions">
                <a
                  className="button secondary"
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open link
                </a>
              </div>
            </div>
          ) : (
            <p>Link unavailable.</p>
          )
        ) : (
          <ul className="assessment-files upload-file-list">
            {item.files.map((file) => {
              const ext = fileExtension(file.originalName)
              return (
                <li key={file.id} className="upload-file-card">
                  <span className={`upload-file-badge ${fileBadgeTone(ext)}`} aria-hidden="true">
                    {ext}
                  </span>
                  <div className="upload-file-info">
                    <strong className="upload-file-name">{file.originalName}</strong>
                    <div className="upload-file-meta">
                      <span>{formatFileSize(file.byteSize)}</span>
                    </div>
                  </div>
                  <div className="actions">
                    <ActionButton
                      icon="download-dark"
                      tone="secondary"
                      disabled={action.pending}
                      onClick={() =>
                        void action.run(() => downloadFile(file.id, file.originalName))
                      }
                    >
                      {action.pending ? 'Preparing…' : 'Download file'}
                    </ActionButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Panel>
  )
}
