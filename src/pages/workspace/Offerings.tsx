import { useCallback, useState } from 'react'
import { SelectControl } from '@/components/SelectControl'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { DataTable, Icon, Panel, Status } from '@/components/ui'
import { ActionButton, Badge, LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { OfferingCard } from '@/components/workspace/OfferingCard'
import { OfferingEditor } from '@/components/workspace/OfferingEditor'
import { OfferingTransition } from '@/components/workspace/OfferingTransition'
import { JoinDialog } from '@/components/workspace/JoinDialog'
import type { OfferingQuery, OfferingView } from '@/services/course-contracts'
import type { Offering } from '@/services/contracts'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'

export function Offerings({
  create = false,
  joining = false,
}: {
  create?: boolean
  joining?: boolean
}) {
  const { identity } = useAuth(),
    me = identity!.me,
    navigate = useNavigate(),
    [params, setParams] = useSearchParams()
  const search = params.get('q') ?? '',
    semester = params.get('semester') ?? '',
    status = (params.get('status') ?? '') as Offering['status'] | '',
    page = Number(params.get('page') ?? 1),
    pageSize = [10, 25, 50, 100].includes(Number(params.get('pageSize')))
      ? Number(params.get('pageSize'))
      : 25,
    courseId = Number(params.get('courseId')) || undefined,
    sort = (
      ['newest', 'title-asc', 'title-desc', 'semester'].includes(params.get('sort') ?? '')
        ? params.get('sort')
        : undefined
    ) as OfferingQuery['sort'],
    display = params.get('view') === 'list' ? 'list' : 'grid'
  const [editing, setEditing] = useState<OfferingView>(),
    [command, setCommand] = useState<{
      item: OfferingView
      action: 'publish' | 'archive' | 'restore'
    }>(),
    [join, setJoin] = useState(joining)
  const load = useCallback(
    () => services.courses.list({ search, semester, status, page, pageSize, courseId, sort }),
    [search, semester, status, page, pageSize, courseId, sort],
  )
  const result = useResource(
    load,
    `offerings:${me.account.id}:${search}:${semester}:${status}:${page}:${pageSize}:${courseId}:${sort}`,
  )
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }
  const renderActions = (r: OfferingView) => (
    <div className="table-actions">
      {r.permissions.edit && (
        <ActionButton tone="secondary" icon="edit" onClick={() => setEditing(r)}>
          Edit
        </ActionButton>
      )}
      {(['publish', 'archive', 'restore'] as const).map(
        (action) =>
          r.permissions[action] && (
            <ActionButton
              icon={action === 'publish' ? 'publish' : action === 'archive' ? 'archive' : 'unlock'}
              key={action}
              tone="secondary"
              onClick={() => setCommand({ item: r, action })}
            >
              {action[0].toUpperCase() + action.slice(1)}
            </ActionButton>
          ),
      )}
      <Link to={`/offerings/${r.offering.id}/team`}>Team</Link>
    </div>
  )
  const closeCreate = () => navigate('/offerings')
  return (
    <div className="course-workspace">
      <div className="course-page-heading">
        <h1>
          {me.account.role === 'STUDENT'
            ? 'Course-section list'
            : me.account.role === 'ADMIN'
              ? 'Course-section operations'
              : 'Course-section management'}
        </h1>
        <div className="actions course-page-actions">
          {me.account.role === 'INSTRUCTOR' && (
            <Link className="button secondary" to="/courses">
              Browse catalog
            </Link>
          )}
          {me.account.role === 'INSTRUCTOR' && me.canCreateCourse && (
            <Link className="button primary" to="/offerings/new">
              <Icon name="add-white" size={16} />
              Create course section
            </Link>
          )}
          {me.account.role === 'STUDENT' && (
            <ActionButton icon="add-white" onClick={() => setJoin(true)}>
              Join by code
            </ActionButton>
          )}
        </div>
      </div>
      <Panel
        title={me.account.role === 'STUDENT' ? 'Your course sections' : 'Managed course sections'}
        icon="book-small"
      >
        <form
          className="course-toolbar"
          role="search"
          aria-label="Find course sections"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="course-control course-search-control">
            <span>Search courses</span>
            <div className="course-control-input">
              <Icon name="search" size={20} inheritColor />
              <input
                type="search"
                placeholder="Course name, code or section…"
                value={search}
                onChange={(event) => update('q', event.target.value)}
              />
            </div>
          </label>
          <label className="course-control course-semester-control">
            <span>Semester</span>
            <div className="course-control-input">
              <Icon name="semester" size={20} inheritColor />
              <input
                placeholder="All semesters"
                value={semester}
                onChange={(event) => update('semester', event.target.value)}
              />
            </div>
          </label>
          <div className="course-control course-status-control">
            <SelectControl
              label="Status"
              icon="filter"
              value={status}
              onChange={(event) => update('status', event.target.value)}
            >
              <option value="">All statuses</option>
              {me.account.role !== 'STUDENT' && <option value="DRAFT">Draft</option>}
              <option value="OPEN">Open</option>
              <option value="ARCHIVED">Archived</option>
            </SelectControl>
          </div>
          <div className="course-control course-sort-control">
            <SelectControl
              label="Sort by"
              icon="sort"
              value={sort ?? ''}
              onChange={(event) => update('sort', event.target.value)}
            >
              <option value="">Default order</option>
              <option value="newest">Newest first</option>
              <option value="title-asc">Course name A–Z</option>
              <option value="title-desc">Course name Z–A</option>
              <option value="semester">Latest semester</option>
            </SelectControl>
          </div>
          {(search || semester || status || sort) && (
            <button
              className="course-clear-filters"
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['q', 'semester', 'status', 'sort', 'page']) next.delete(key)
                setParams(next, { replace: true })
              }}
            >
              Clear filters
            </button>
          )}
        </form>
        <div className="course-results-heading">
          <span className="course-result-count" aria-live="polite">
            {result.data
              ? `${result.data.totalItems} course sections · Page ${result.data.totalPages ? result.data.page : 0} of ${result.data.totalPages}`
              : 'Course sections'}
          </span>
          <div className="course-view-switch" role="group" aria-label="Course display">
            {(['grid', 'list'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                aria-pressed={display === mode}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.set('view', mode)
                  setParams(next, { replace: true })
                }}
              >
                <Icon name={`view-${mode}`} size={18} inheritColor />
                {mode === 'grid' ? 'Grid' : 'List'}
              </button>
            ))}
          </div>
        </div>
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {!result.data.items.length ? (
              <Status>No course sections match your access and filters.</Status>
            ) : display === 'grid' ? (
              <div className="course-cards">
                {result.data.items.map((item) => (
                  <OfferingCard
                    key={item.offering.id}
                    offering={item.offering}
                    actions={me.account.role !== 'STUDENT' && renderActions(item)}
                  >
                    <small>
                      {item.lead?.displayName ?? 'Lead unavailable'}
                      {item.lead?.status === 'LOCKED' && <Badge value="LOCKED" />}
                    </small>
                    {me.account.role === 'STUDENT' && (
                      <>
                        <span className="course-completion">
                          {item.totalMaterials
                            ? `${item.completedMaterials} / ${item.totalMaterials} published materials completed`
                            : 'No published materials'}
                        </span>
                        <progress
                          aria-label={`Material completion for ${item.offering.title}`}
                          max={item.totalMaterials || 1}
                          value={item.completedMaterials}
                        />
                      </>
                    )}
                  </OfferingCard>
                ))}
              </div>
            ) : (
              <DataTable
                rows={result.data.items}
                rowKey={(r) => r.offering.id}
                columns={[
                  {
                    label: 'Course section',
                    render: (r) => (
                      <Link to={`/offerings/${r.offering.id}`}>
                        {r.offering.courseCode} · {r.offering.sectionCode}
                        <small className="cell-detail">{r.offering.title}</small>
                      </Link>
                    ),
                  },
                  { label: 'Semester', render: (r) => r.offering.semester },
                  {
                    label: 'Lead instructor',
                    render: (r) => (
                      <>
                        {r.lead?.displayName ?? 'Unavailable'}
                        {r.lead?.status === 'LOCKED' && <Badge value="LOCKED" />}
                      </>
                    ),
                  },
                  { label: 'Status', render: (r) => <Badge value={r.offering.status} /> },
                  ...(me.account.role === 'STUDENT'
                    ? [
                        {
                          label: 'Materials completed',
                          render: (r: OfferingView) =>
                            r.totalMaterials
                              ? `${r.completedMaterials} / ${r.totalMaterials}`
                              : 'No published materials',
                        },
                      ]
                    : [
                        {
                          label: 'Actions',
                          render: (r: OfferingView) => renderActions(r),
                        },
                      ]),
                ]}
              />
            )}
          </>
        )}

        {result.data && (
          <Pager
            value={result.data}
            changeSize={(size) => update('pageSize', String(size))}
            change={(page) => {
              const next = new URLSearchParams(params)
              next.set('page', String(page))
              setParams(next)
            }}
          />
        )}
      </Panel>
      {create &&
        (me.account.role === 'INSTRUCTOR' && me.canCreateCourse ? (
          <OfferingEditor courseId={courseId} close={closeCreate} />
        ) : (
          <Status error>Course creation capability for an active instructor is required.</Status>
        ))}
      {editing && <OfferingEditor saved={editing} close={() => setEditing(undefined)} />}
      {command && (
        <OfferingTransition
          item={command.item}
          command={command.action}
          close={() => setCommand(undefined)}
          reload={result.reload}
        />
      )}
      {join && (
        <JoinDialog
          offeringId={Number(params.get('offeringId')) || undefined}
          close={() => {
            setJoin(false)
            if (joining) navigate('/offerings')
          }}
        />
      )}
    </div>
  )
}
