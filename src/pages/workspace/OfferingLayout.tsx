import { WorkspaceAccessContext } from '@/services/workspace-access-context'
import { useCallback } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router'
import { Status, Icon } from '@/components/ui'
import { LoadState } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'

export function OfferingLayout() {
  const id = Number(useParams().offeringId),
    { identity } = useAuth()
  const load = useCallback(() => services.courses.get(id), [id]),
    result = useResource(load, `offering:${identity!.me.account.id}:${id}`, { retainOnError: true })
  if (!result.data)
    return (
      <div className="course-workspace">
        <h1>Course section</h1>
        <LoadState {...result} retry={result.reload} />
        <Link to="/offerings">Back to course sections</Link>
      </div>
    )
  const view = result.data
  return (
    <div className="course-workspace">
      <div className="breadcrumb">
        <Link to="/offerings">Course sections</Link> / {view.offering.courseCode} ·{' '}
        {view.offering.sectionCode}
      </div>
      <nav className="section-tabs" aria-label="Course section navigation">
        <NavLink end to={`/offerings/${id}`}>
          <Icon name="dashboard" size={18} inheritColor />
          Overview
        </NavLink>
        {view.permissions.academic && (
          <NavLink to={`/offerings/${id}/materials`}>
            <Icon name="book-small" size={18} inheritColor />
            Materials
          </NavLink>
        )}
        {view.permissions.academic && (
          <NavLink to={`/offerings/${id}/assignments`}>
            <Icon name="assignments" size={18} inheritColor />
            Assignments
          </NavLink>
        )}
        {view.permissions.academic && (
          <NavLink to={`/offerings/${id}/results`}>
            <Icon name="results" size={18} inheritColor />
            Results
          </NavLink>
        )}
        {view.permissions.academic && (
          <NavLink to={`/offerings/${id}/quizzes`}>
            <Icon name="quizzes" size={18} inheritColor />
            Quizzes
          </NavLink>
        )}
        <NavLink to={`/offerings/${id}/members`}>
          <Icon name="people" size={18} inheritColor />
          Members
        </NavLink>
        <NavLink to={`/offerings/${id}/team`}>
          <Icon name="people-small" size={18} inheritColor />
          Teaching team
        </NavLink>
        {view.permissions.academic && (
          <NavLink to={`/offerings/${id}/announcements`}>
            <Icon name="announcements" size={18} inheritColor />
            Announcements
          </NavLink>
        )}
      </nav>
      {view.offering.status === 'ARCHIVED' && (
        <Status>This course section is archived. Learning content is read-only.</Status>
      )}
      {result.loading && <Status>Refreshing course section…</Status>}
      {result.error && (
        <>
          <LoadState loading={false} error={result.error} retry={result.reload} />
          <Link to="/offerings">Back to course sections</Link>
        </>
      )}
      <WorkspaceAccessContext.Provider
        value={result.error ? { error: result.error, retry: result.reload } : undefined}
      >
        <div className={`offering-content ${result.error ? 'permission-lost' : ''}`}>
          <Outlet context={{ view, refreshing: result.loading, reload: result.reload }} />
        </div>
      </WorkspaceAccessContext.Provider>
    </div>
  )
}
