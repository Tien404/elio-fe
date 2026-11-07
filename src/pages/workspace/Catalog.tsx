import { useCallback } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { DataTable, Field, Panel, Status } from '@/components/ui'
import { LoadState, Pager } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'

export function Catalog() {
  const { identity } = useAuth(),
    [params, setParams] = useSearchParams()
  const search = params.get('q') ?? '',
    page = Number(params.get('page') ?? 1)
  const load = useCallback(() => services.courses.catalog({ search, page }), [search, page])
  const result = useResource(load, `catalog:${identity!.me.account.id}:${search}:${page}`)
  return (
    <div className="course-workspace">
      <h1>Course catalog</h1>
      <Panel title="Catalog subjects" icon="book-small">
        <div className="filters">
          {' '}
          <Field
            label="Search catalog"
            value={search}
            onChange={(e) => setParams({ q: e.target.value })}
          />
        </div>
        <LoadState {...result} retry={result.reload} />
        {result.data && (
          <>
            {!result.data.items.length ? (
              <Status>No catalog subjects match your search.</Status>
            ) : (
              <DataTable
                rows={result.data.items}
                rowKey={(c) => c.id}
                columns={[
                  {
                    label: 'Course code',
                    render: (c) => <Link to={`/courses/${c.id}`}>{c.courseCode}</Link>,
                  },
                  { label: 'Course name', render: (c) => c.courseName },
                  { label: 'Credits', render: (c) => c.credits },
                  {
                    label: 'Actions',
                    render: (c) =>
                      identity!.me.canCreateCourse ? (
                        <Link className="button secondary" to={`/offerings/new?courseId=${c.id}`}>
                          Create section
                        </Link>
                      ) : (
                        <Link to={`/courses/${c.id}`}>View subject</Link>
                      ),
                  },
                ]}
              />
            )}
            <Pager
              value={result.data}
              change={(page) => setParams({ q: search, page: String(page) })}
            />
          </>
        )}
        <div className="actions">
          <Link className="button secondary" to="/offerings">
            Course sections
          </Link>
          {identity!.me.canCreateCourse && (
            <Link className="button primary" to="/offerings/new">
              Create course section
            </Link>
          )}
        </div>
      </Panel>
    </div>
  )
}
export function CatalogDetail() {
  const id = Number(useParams().courseId),
    { identity } = useAuth()
  const load = useCallback(() => services.courses.catalogDetail(id), [id]),
    result = useResource(load, `catalog-detail:${id}:${identity!.me.account.id}`)
  return (
    <div className="course-workspace">
      <div className="breadcrumb">
        <Link to="/courses">Catalog</Link> / Subject
      </div>
      <h1>Catalog subject</h1>
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <Panel title={result.data.courseName} icon="book-small">
          <p>
            {result.data.courseCode} · {result.data.credits} credits
          </p>
          <div className="actions">
            <Link className="button secondary" to={`/offerings?courseId=${id}`}>
              Your sections for this subject
            </Link>
            {identity!.me.canCreateCourse && (
              <Link className="button primary" to={`/offerings/new?courseId=${id}`}>
                Create section
              </Link>
            )}
          </div>
        </Panel>
      )}
    </div>
  )
}
