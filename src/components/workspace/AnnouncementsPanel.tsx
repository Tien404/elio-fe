import { apiMode } from '@/services'
import { formatInstant } from '@/services/presentation'
import { useCallback, useState } from 'react'
import { Button, Dialog, Field, Icon, Panel, Status } from '@/components/ui'
import { AnnouncementEditor } from '@/components/workspace/AnnouncementEditor'
import { ActionButton, Badge, Feedback, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import type { AnnouncementView } from '@/services/course-contracts'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { ServiceError, mustReview } from '@/services/errors'
import { useResource } from '@/services/use-resource'

export function AnnouncementsPanel({
  offeringId,
  writable,
  canPublish,
  linkedId,
  clearLink,
}: {
  offeringId: number
  writable: boolean
  canPublish: boolean
  linkedId?: number
  clearLink?(): void
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [editor, setEditor] = useState<{ item?: AnnouncementView }>(),
    [reading, setReading] = useState<number>()
  const activeId = reading ?? linkedId
  const publication = useAction()
  const load = useCallback(
      () => services.content.announcements(offeringId, { page, search }),
      [offeringId, page, search],
    ),
    result = useResource(load, `announcements:${offeringId}:${page}:${search}`)
  const read = useCallback(async () => {
    if (!activeId) return null
    const item = await services.content.announcement(activeId)
    if (item.offeringId !== offeringId)
      throw new ServiceError(404, 'Announcement not found in this course section.')
    return item
  }, [activeId, offeringId])
  const detail = useResource(read, `announcement:${offeringId}:${activeId}`)
  function closeReader() {
    setReading(undefined)
    clearLink?.()
  }
  return (
    <>
      <Panel
        title="Class announcements"
        icon="announcements"
        actions={
          writable ? (
            <ActionButton icon="add-white" onClick={() => setEditor({})}>
              Create announcement
            </ActionButton>
          ) : undefined
        }
      >
        <Field
          label="Search announcements"
          maxLength={200}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <LoadState {...result} retry={result.reload} />
        <Feedback
          action={publication}
          review={() => {
            result.reload()
            publication.clear()
          }}
        />
        {result.data && (
          <>
            {!result.data.items.length && <Status>No announcements are available.</Status>}
            {result.data.items.map((item) => {
              const hasManageActions =
                (!apiMode && writable && item.status !== 'ARCHIVED') ||
                (canPublish && item.status !== 'ARCHIVED' && item.hasUnpublishedChanges)
              return (
                <article
                  className="announcement-card clickable"
                  key={item.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Read announcement: ${item.title}`}
                  onClick={() => setReading(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setReading(item.id)
                    }
                  }}
                >
                  <h3>{item.title}</h3>
                  <p>
                    <Badge value={item.status} />{' '}
                    {item.hasUnpublishedChanges && <Badge value="DRAFT_CHANGES" />}
                    {item.publishedAt ? formatInstant(item.publishedAt) : 'Not published'}
                  </p>
                  <p>{item.body.length > 180 ? `${item.body.slice(0, 180)}…` : item.body}</p>
                  {hasManageActions && (
                    <div
                      className="actions"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {!apiMode && writable && item.status !== 'ARCHIVED' && (
                        <Button tone="secondary" onClick={() => setEditor({ item })}>
                          <Icon name="edit" size={20} />
                          Edit announcement
                        </Button>
                      )}
                      {canPublish && item.status !== 'ARCHIVED' && item.hasUnpublishedChanges && (
                        <ActionButton
                          icon="publish-small"
                          disabled={
                            publication.pending || result.loading || mustReview(publication.error)
                          }
                          onClick={() =>
                            void publication.run(
                              () => services.content.publishAnnouncement(item.id, item.version),
                              undefined,
                              'Announcement published.',
                            )
                          }
                        >
                          Publish saved draft
                        </ActionButton>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
            <Pager value={result.data} change={setPage} />
          </>
        )}
      </Panel>
      {editor && (
        <AnnouncementEditor
          offeringId={offeringId}
          saved={editor.item}
          canPublish={canPublish}
          close={() => setEditor(undefined)}
        />
      )}
      {activeId && (
        <Dialog
          title={detail.data?.title ?? 'Announcement'}
          wide
          icon="announcements"
          close={closeReader}
        >
          <LoadState {...detail} retry={detail.reload} />
          {detail.data && (
            <>
              <p className="form-description">
                {detail.data.hasUnpublishedChanges
                  ? 'Private draft'
                  : detail.data.publishedAt
                    ? formatInstant(detail.data.publishedAt)
                    : 'Draft'}
              </p>
              <p className="material-body">{detail.data.body}</p>
            </>
          )}
          <Button tone="secondary" onClick={closeReader}>
            Close
          </Button>
        </Dialog>
      )}
    </>
  )
}
