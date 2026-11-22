import { formatActivityReason } from '@/services/presentation'
import { LearningOverview } from '@/components/personal/LearningOverview'
import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable, Field, Panel, Status, PageHeader, Icon } from '@/components/ui'
import { Badge, LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
export function Progress() {
  const [params] = useSearchParams()
  const { identity } = useAuth()
  if (identity!.me.account.role === 'ADMIN')
    return <Status error>Academic access is required to view progress.</Status>
  return Number(params.get('offeringId')) > 0 ? (
    <ProgressDetail />
  ) : (
    <LearningOverview mode="progress" />
  )
}
function ProgressDetail() {
  const { identity } = useAuth()
  const teacher = identity!.me.account.role === 'INSTRUCTOR'
  const [params, setParams] = useSearchParams(),
    id = Number(params.get('offeringId')) || 0,
    studentId = Number(params.get('studentId')) || 0,
    state = params.get('state') ?? 'ALL',
    search = params.get('search') ?? '',
    page = Number(params.get('page')) || 1,
    sectionsLoad = useCallback(() => services.courses.list({ pageSize: 100 }), []),
    sections = useResource(sectionsLoad, 'progress-sections'),
    load = useCallback(
      () => (id ? services.personal.progress(id, { state, search, page }) : Promise.resolve(null)),
      [id, state, search, page],
    ),
    r = useResource(load, `progress:${params}`),
    selected =
      r.data?.rows.items.find((a) => a.studentId === studentId) ??
      (!r.data?.teacher ? r.data?.rows.items[0] : undefined)
  function filter(k: string, v: string) {
    setParams((p) => {
      p.set(k, v)
      p.delete('page')
      return p
    })
  }
  return (
    <div className="course-workspace">
      <div className="breadcrumb">
        <Link to="/progress">All course progress</Link>
      </div>
      <PageHeader title={teacher ? 'Class progress' : 'My progress'} />
      <Panel title="Course progress" icon="info">
        <div className="filters">
          <Select
            label="Course section"
            value={id || ''}
            onChange={(e) => filter('offeringId', e.target.value)}
          >
            <option value="">Choose a section</option>
            {sections.data?.items
              .filter((section) => section.permissions.academic)
              .map(({ offering: o }) => (
                <option value={o.id} key={o.id}>
                  {o.courseCode} · {o.sectionCode} · {o.semester}
                </option>
              ))}
          </Select>
          {teacher && (
            <>
              <Select
                label="Completion filter"
                value={state}
                onChange={(e) => filter('state', e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="INCOMPLETE">Incomplete / no required activities</option>
                <option value="COMPLETE">Complete</option>
              </Select>
              <Field
                label="Search student"
                maxLength={200}
                value={search}
                onChange={(e) => filter('search', e.target.value)}
              />
            </>
          )}
        </div>
        <LoadState {...sections} retry={sections.reload} />
        <LoadState {...r} retry={r.reload} />
        <p className="supporting-note">Completion tracks participation in required activities.</p>
        {teacher && r.data && !r.error && (
          <>
            <DataTable
              rows={r.data.rows.items}
              rowKey={(a) => a.membershipId}
              columns={[
                { label: 'Student', render: (a) => `${a.displayName} · ${a.studentId}` },
                {
                  label: 'Completed / Required',
                  render: (a) =>
                    `${a.completed} / ${a.total} · ${a.percent === null ? 'No required activities' : `${a.percent}%`}`,
                },
                {
                  label: 'Missing activity',
                  render: (a) =>
                    a.items
                      .filter((i) => !i.complete)
                      .map((i) => i.title)
                      .join('; ') || 'None',
                },
                {
                  label: 'Actions',
                  render: (a) => (
                    <Link
                      className="button secondary"
                      to={`?${new URLSearchParams({ ...Object.fromEntries(params), studentId: String(a.studentId) })}`}
                    >
                      View individual details
                    </Link>
                  ),
                },
              ]}
            />
            {!r.data.rows.totalItems && <Status>No students match these filters.</Status>}
            <Pager
              value={r.data.rows}
              change={(p) =>
                setParams((s) => {
                  s.set('page', String(p))
                  return s
                })
              }
            />
          </>
        )}
        {!teacher && selected && !r.error && (
          <div className="progress-summary">
            <strong>{selected.percent === null ? '—' : `${selected.percent}%`}</strong>
            <div>
              <p>
                {selected.completed} of {selected.total} required activities completed
              </p>
              {selected.total > 0 && (
                <progress
                  aria-label="Required activity completion"
                  value={selected.completed}
                  max={selected.total}
                />
              )}
            </div>
          </div>
        )}
        {!id && <Status>Choose a course section to view its checklist.</Status>}
      </Panel>
      {selected && !r.error && (
        <Panel title={teacher ? 'Student activity progress' : 'Activity checklist'} icon="progress">
          <p>
            {selected.displayName} · {selected.completed} / {selected.total}
          </p>
          {(selected.notice === 'NO_MANDATORY_ACTIVITIES' || selected.total === 0) && (
            <Status>
              No published mandatory activities. A completion percentage is unavailable.
            </Status>
          )}
          {teacher ? (
            <DataTable
              rows={selected.items}
              rowKey={(a) => a.id}
              columns={[
                { label: 'Activity', render: (a) => <Link to={a.href}>{a.title}</Link> },
                { label: 'Completed', render: (a) => (a.complete ? 'Yes' : 'No') },
                { label: 'Reason', render: (a) => a.reason },
              ]}
            />
          ) : (
            <div className="resource-list">
              {selected.items.map((item) => (
                <div className="resource-row" key={item.id}>
                  <span className="resource-icon">
                    <Icon
                      name={item.complete ? 'check' : 'document-small'}
                      size={22}
                      inheritColor
                    />
                  </span>
                  <div className="resource-copy">
                    <Link to={item.href}>{item.title}</Link>
                    <p>{formatActivityReason(item.reason)}</p>
                  </div>
                  <Badge value={item.complete ? 'COMPLETE' : 'INCOMPLETE'} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}
    </div>
  )
}
