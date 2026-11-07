import { formatInstant } from '@/services/presentation'
import { useCallback, useState } from 'react'
import { Button, Dialog, Field, Panel, Status } from '@/components/ui'
import { AnnouncementEditor } from '@/components/workspace/AnnouncementEditor'
import { ActionButton, Badge, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import type { AnnouncementView } from '@/services/course-contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'

export function AnnouncementsPanel({
  offeringId,
  writable,
}: {
  offeringId: number
  writable: boolean
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [editor, setEditor] = useState<{ item?: AnnouncementView }>(),
    [reading, setReading] = useState<AnnouncementView>()
  const load = useCallback(
      () => services.content.announcements(offeringId, { page, search }),
      [offeringId, page, search],
    ),
    result = useResource(load, `announcements:${offeringId}:${page}:${search}`)
  return (
    <>
      <Panel title="Class announcements" icon="messages">
        <Field
          label="Search announcements"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {!result.data.items.length && <Status>No announcements are available.</Status>}
            {result.data.items.map((item) => (
              <article className="announcement-card" key={item.id}>
                <h3>{item.title}</h3>
                <p>
                  <Badge value={item.status} />{' '}
                  {item.hasUnpublishedChanges && <Badge value="DRAFT_CHANGES" />}
                  {item.publishedAt ? formatInstant(item.publishedAt) : 'Not published'}
                </p>
                <p>{item.body.length > 180 ? `${item.body.slice(0, 180)}…` : item.body}</p>
                <div className="actions">
                  <ActionButton icon="messages" tone="secondary" onClick={() => setReading(item)}>
                    Read announcement
                  </ActionButton>
                  {writable && (
                    <Button tone="secondary" onClick={() => setEditor({ item })}>
                      Edit announcement
                    </Button>
                  )}
                </div>
              </article>
            ))}
            <Pager value={result.data} change={setPage} />
          </>
        )}
        {writable && (
          <ActionButton icon="add-white" onClick={() => setEditor({})}>
            Create announcement
          </ActionButton>
        )}
      </Panel>
      {editor && (
        <AnnouncementEditor
          offeringId={offeringId}
          saved={editor.item}
          close={() => setEditor(undefined)}
        />
      )}
      {reading && (
        <Dialog title={reading.title} wide icon="messages" close={() => setReading(undefined)}>
          <p className="form-description">
            {reading.publishedAt ? formatInstant(reading.publishedAt) : 'Draft · Not published'}
          </p>
          <div className="material-body">
            <p>{reading.body}</p>
          </div>
          <Button tone="secondary" onClick={() => setReading(undefined)}>
            Close
          </Button>
        </Dialog>
      )}
    </>
  )
}
