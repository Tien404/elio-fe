import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  Button,
  DataTable,
  Field,
  Icon,
  Panel,
  Status,
  PageHeader,
  EmptyState,
} from '@/components/ui'
import {
  ActionButton,
  Badge,
  ConfirmDialog,
  Feedback,
  LoadState,
  Pager,
  Select,
} from '@/components/workspace/WorkspaceUI'
import { MaterialEditor } from '@/components/workspace/MaterialEditor'
import { MaterialReader } from '@/components/workspace/MaterialReader'
import { TopicDialog } from '@/components/workspace/TopicDialog'
import { useOffering } from '@/pages/workspace/offering-context'
import type { MaterialView, Topic } from '@/services/course-contracts'
import type { Resource } from '@/services/contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'

export function Materials() {
  const { view } = useOffering(),
    { identity } = useAuth(),
    id = view.offering.id,
    materialId = Number(useParams().materialId) || undefined,
    teacher = identity!.me.account.role === 'INSTRUCTOR'
  const [topicPage, setTopicPage] = useState(1),
    [page, setPage] = useState(1),
    [topicId, setTopicId] = useState(0),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState<Resource['status'] | ''>(''),
    [editor, setEditor] = useState<{ item?: MaterialView }>(),
    [topicEditor, setTopicEditor] = useState<{ topic?: Topic }>(),
    [archiving, setArchiving] = useState<MaterialView>()
  const topicLoad = useCallback(
      () => services.content.topics(id, { page: topicPage }),
      [id, topicPage],
    ),
    topics = useResource(topicLoad, `topics:${id}:${topicPage}`)
  const listLoad = useCallback(
      () => services.content.materials(id, { page, topicId: topicId || undefined, search, status }),
      [id, page, topicId, search, status],
    ),
    result = useResource(listLoad, `materials:${id}:${page}:${topicId}:${search}:${status}`)
  const itemLoad = useCallback(
      () => (materialId ? services.content.material(materialId) : Promise.resolve(null)),
      [materialId],
    ),
    item = useResource(itemLoad, `material:${id}:${materialId}`)
  const ordering = useAction(),
    publishing = useAction()
  const saveState = (m: MaterialView, state: Resource['status']) =>
    services.content.saveMaterial(
      id,
      m.resource.id,
      { ...m.resource, topicId: m.resource.topicId, status: state, mandatory: m.mandatory },
      m.resource.version,
    )
  return (
    <>
      <PageHeader title={teacher ? 'Manage materials' : 'Learning materials'} />
      {!view.permissions.academic ? (
        <Status error>Current academic membership is required.</Status>
      ) : (
        <>
          {teacher && (
            <Panel
              title="Topics"
              icon="book-small"
              actions={
                view.permissions.teach ? (
                  <ActionButton tone="secondary" icon="add" onClick={() => setTopicEditor({})}>
                    Create topic
                  </ActionButton>
                ) : undefined
              }
            >
              <LoadState {...topics} retry={topics.reload} />
              <Feedback action={ordering} />
              {topics.data && (
                <>
                  {topics.data.items.length ? (
                    <DataTable
                      rows={topics.data.items}
                      rowKey={(t) => t.id}
                      columns={[
                        { label: 'Order', render: (t) => t.position },
                        {
                          label: 'Topic',
                          render: (t) => (
                            <Button
                              tone="secondary"
                              aria-pressed={topicId === t.id}
                              onClick={() => {
                                setTopicId(topicId === t.id ? 0 : t.id)
                                setPage(1)
                              }}
                            >
                              {t.title}
                            </Button>
                          ),
                        },
                        ...(view.permissions.teach
                          ? [
                              {
                                label: 'Actions',
                                render: (t: Topic) => (
                                  <div className="table-actions">
                                    <ActionButton
                                      icon="edit"
                                      tone="secondary"
                                      onClick={() => setTopicEditor({ topic: t })}
                                    >
                                      Edit topic
                                    </ActionButton>
                                    <ActionButton
                                      icon="move-up"
                                      tone="secondary"
                                      aria-label={`Move ${t.title} up`}
                                      disabled={ordering.pending || t.position <= 1}
                                      onClick={() =>
                                        void ordering.run(() =>
                                          services.content.updateTopic(
                                            t.id,
                                            { title: t.title, position: t.position - 1 },
                                            t.version,
                                          ),
                                        )
                                      }
                                    >
                                      Move up
                                    </ActionButton>
                                    <ActionButton
                                      icon="move-down-white"
                                      aria-label={`Move ${t.title} down`}
                                      disabled={
                                        ordering.pending || t.position >= topics.data!.totalItems
                                      }
                                      onClick={() =>
                                        void ordering.run(() =>
                                          services.content.updateTopic(
                                            t.id,
                                            { title: t.title, position: t.position + 1 },
                                            t.version,
                                          ),
                                        )
                                      }
                                    >
                                      Move down
                                    </ActionButton>
                                  </div>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : (
                    <Status>
                      No published topics are available
                      {teacher ? '. Create a topic before adding a material.' : '.'}
                    </Status>
                  )}
                  <Pager value={topics.data} change={setTopicPage} />
                </>
              )}
              {teacher && topicId > 0 && (
                <Button
                  tone="secondary"
                  onClick={() => {
                    setTopicId(0)
                    setPage(1)
                  }}
                >
                  Show all topics
                </Button>
              )}
            </Panel>
          )}
          <Panel
            title="Materials"
            icon="document-small"
            actions={
              view.permissions.teach ? (
                <ActionButton tone="secondary" icon="add" onClick={() => setEditor({})}>
                  Create material
                </ActionButton>
              ) : undefined
            }
          >
            {!teacher && (
              <>
                <LoadState {...topics} retry={topics.reload} />
                {topics.data && (
                  <>
                    <div className="topic-list" role="group" aria-label="Filter materials by topic">
                      <Button
                        tone="secondary"
                        aria-pressed={!topicId}
                        onClick={() => {
                          setTopicId(0)
                          setPage(1)
                        }}
                      >
                        All topics
                      </Button>
                      {topics.data.items.map((topic) => (
                        <Button
                          key={topic.id}
                          tone="secondary"
                          aria-pressed={topicId === topic.id}
                          onClick={() => {
                            setTopicId(topic.id)
                            setPage(1)
                          }}
                        >
                          {topic.title}
                        </Button>
                      ))}
                    </div>
                    {topics.data.totalPages > 1 && (
                      <Pager value={topics.data} change={setTopicPage} />
                    )}
                  </>
                )}
              </>
            )}
            <div className="filters">
              <Field
                label="Search materials"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
              />
              {teacher && (
                <Select
                  label="Material status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as Resource['status'] | '')
                    setPage(1)
                  }}
                >
                  <option value="">All states</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              )}
            </div>
            <LoadState {...result} retry={result.reload} />
            <Feedback action={publishing} />
            {result.data && (
              <>
                {result.data.items.length ? (
                  teacher ? (
                    <DataTable
                      rows={result.data.items}
                      rowKey={(m) => m.resource.id}
                      columns={[
                        {
                          label: 'Material',
                          render: (m) => (
                            <Link to={`/offerings/${id}/materials/${m.resource.id}`}>
                              {m.resource.title}
                            </Link>
                          ),
                        },
                        {
                          label: 'Topic / type',
                          render: (m) => (
                            <>
                              {topics.data?.items.find((t) => t.id === m.resource.topicId)?.title ??
                                `Topic ${m.resource.topicId}`}
                              <small className="cell-detail">{m.resource.kind.toLowerCase()}</small>
                            </>
                          ),
                        },
                        {
                          label: teacher ? 'Status' : 'Completion',
                          render: (m) =>
                            teacher ? (
                              <Badge value={m.resource.status} />
                            ) : m.completed ? (
                              'Completed'
                            ) : (
                              'Not completed'
                            ),
                        },
                        ...(view.permissions.teach
                          ? [
                              {
                                label: 'Actions',
                                render: (m: MaterialView) => (
                                  <div className="table-actions">
                                    {m.resource.status !== 'ARCHIVED' && (
                                      <>
                                        <ActionButton
                                          icon="edit"
                                          tone="secondary"
                                          onClick={() => setEditor({ item: m })}
                                        >
                                          Edit
                                        </ActionButton>
                                        {m.resource.status === 'DRAFT' && (
                                          <ActionButton
                                            icon="publish-small"
                                            disabled={publishing.pending}
                                            onClick={() =>
                                              void publishing.run(
                                                () => saveState(m, 'PUBLISHED'),
                                                undefined,
                                                'Material published.',
                                              )
                                            }
                                          >
                                            Publish
                                          </ActionButton>
                                        )}
                                        {m.resource.status === 'PUBLISHED' && (
                                          <ActionButton
                                            danger
                                            icon="archive-white"
                                            onClick={() => setArchiving(m)}
                                          >
                                            Archive
                                          </ActionButton>
                                        )}
                                      </>
                                    )}
                                  </div>
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                  ) : (
                    <div className="resource-list">
                      {result.data.items.map((material) => (
                        <div className="resource-row" key={material.resource.id}>
                          <span className="resource-icon">
                            <Icon
                              name={
                                material.resource.kind === 'FILE' ? 'document-small' : 'book-small'
                              }
                              size={22}
                              inheritColor
                            />
                          </span>
                          <div className="resource-copy">
                            <Link to={`/offerings/${id}/materials/${material.resource.id}`}>
                              {material.resource.title}
                            </Link>
                            <p>
                              {topics.data?.items.find(
                                (topic) => topic.id === material.resource.topicId,
                              )?.title ?? 'Course material'}{' '}
                              ·{' '}
                              {material.resource.kind === 'TEXT'
                                ? 'Reading'
                                : material.resource.kind === 'FILE'
                                  ? 'File'
                                  : 'External link'}
                              {material.mandatory ? ' · Required' : ''}
                            </p>
                          </div>
                          <Badge value={material.completed ? 'COMPLETE' : 'NOT_STARTED'} />
                          <Link
                            className="button secondary"
                            to={`/offerings/${id}/materials/${material.resource.id}`}
                          >
                            View material
                          </Link>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <EmptyState
                    title="No materials found"
                    description="Try another topic or search term."
                    icon="document-small"
                  />
                )}
                <Pager value={result.data} change={setPage} />
              </>
            )}
          </Panel>
          {materialId && (
            <>
              <LoadState {...item} retry={item.reload} />
              {item.data &&
                (item.data.resource.offeringId === id ? (
                  <MaterialReader item={item.data} offering={view} />
                ) : (
                  <Status error>This material belongs to a different course section.</Status>
                ))}
            </>
          )}
        </>
      )}
      {editor && (
        <MaterialEditor offeringId={id} saved={editor.item} close={() => setEditor(undefined)} />
      )}
      {topicEditor && (
        <TopicDialog
          offeringId={id}
          topic={topicEditor.topic}
          close={() => setTopicEditor(undefined)}
        />
      )}
      {archiving && (
        <ConfirmDialog
          title="Archive material?"
          icon="archive"
          confirm="Archive material"
          danger
          close={() => setArchiving(undefined)}
          run={() => saveState(archiving, 'ARCHIVED')}
        >
          <p>
            This material will no longer be visible to students or counted as a current published
            learning material.
          </p>
        </ConfirmDialog>
      )}
    </>
  )
}
