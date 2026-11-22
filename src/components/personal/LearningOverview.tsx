import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState, Field, Icon, PageHeader, Panel, Status } from '@/components/ui'
import { Badge, LoadState } from '@/components/workspace/WorkspaceUI'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
import { loadLearningOverview, type LearningOverviewMode } from '@/services/learning-overview'

export function LearningOverview({ mode }: { mode: LearningOverviewMode }) {
  const { identity } = useAuth()
  const teacher = identity!.me.account.role === 'INSTRUCTOR'
  const [search, setSearch] = useState('')
  const load = useCallback(() => loadLearningOverview(mode, teacher), [mode, teacher])
  const result = useResource(load, `learning-overview:${identity!.me.account.id}:${mode}`)
  const courses = result.data ?? []
  const progressRows = courses.flatMap((course) => course.progress ?? [])
  const resultRows = courses.flatMap((course) => course.results ?? [])
  const cells = resultRows.flatMap((row) => row.cells)
  const completed = progressRows.reduce((sum, row) => sum + row.completed, 0)
  const required = progressRows.reduce((sum, row) => sum + row.total, 0)
  const percent = required ? Math.round((completed / required) * 100) : null
  const metrics =
    mode === 'progress'
      ? [
          {
            label: 'Course sections',
            value: courses.length,
            icon: 'metric-courses',
            detail: teacher ? 'Teaching sections' : 'Enrolled sections',
          },
          {
            label: 'Completed activities',
            value: completed,
            icon: 'metric-assignments',
            detail: `${required} required activities`,
          },
          {
            label: 'Remaining activities',
            value: required - completed,
            icon: 'metric-quizzes',
            detail: 'Required activities to complete',
          },
          {
            label: 'Overall progress',
            value: percent === null ? '—' : `${percent}%`,
            icon: 'metric-progress',
            detail: 'Across required activities',
          },
        ]
      : [
          {
            label: 'Course sections',
            value: courses.length,
            icon: 'metric-courses',
            detail: teacher ? 'Teaching sections' : 'Enrolled sections',
          },
          {
            label: teacher ? 'Final student results' : 'Final course results',
            value: resultRows.filter((row) => row.final).length,
            icon: 'metric-progress',
            detail: 'Fully published results',
          },
          {
            label: 'Published results',
            value: cells.filter((cell) => cell.score !== null).length,
            icon: 'metric-assignments',
            detail: 'Assignments and quizzes',
          },
          {
            label: 'Awaiting results',
            value: cells.filter((cell) => cell.score === null).length,
            icon: 'metric-quizzes',
            detail: 'No published score yet',
          },
        ]
  const visible = courses.filter(({ section: { offering } }) =>
    `${offering.title} ${offering.courseCode} ${offering.sectionCode} ${offering.semester}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )
  return (
    <div className="course-workspace learning-overview">
      <PageHeader
        title={
          mode === 'progress'
            ? teacher
              ? 'Class progress'
              : 'My progress'
            : teacher
              ? 'Class gradebook'
              : 'My results'
        }
      />
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <>
          <div className="metric-grid learning-overview-metrics">
            {metrics.map((metric) => (
              <div className="metric-card" key={metric.label}>
                <span className={`metric-artwork ${metric.icon}`}>
                  <Icon name={metric.icon} size="100%" inheritColor={false} />
                </span>
                <div>
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </div>
              </div>
            ))}
          </div>
          {courses.some((course) => course.error) && (
            <Status error>
              Some course summaries are unavailable. Their data is excluded from the totals.{' '}
              <button className="text-button" onClick={result.reload}>
                Retry
              </button>
            </Status>
          )}
          <Panel
            title={mode === 'progress' ? 'Progress by course' : 'Results by course'}
            icon={mode === 'progress' ? 'progress' : 'results'}
          >
            <div className="filters">
              <Field
                label="Search courses"
                placeholder="Course name or code…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="learning-course-list">
              {visible.map((course) => {
                const offering = course.section.offering
                const rows = course.progress ?? []
                const done = rows.reduce((sum, row) => sum + row.completed, 0)
                const total = rows.reduce((sum, row) => sum + row.total, 0)
                const coursePercent = total ? Math.round((done / total) * 100) : null
                const ownResult = course.results?.[0]
                const published = (course.results ?? [])
                  .flatMap((row) => row.cells)
                  .filter((cell) => cell.score !== null).length
                const allResults = (course.results ?? []).reduce(
                  (sum, row) => sum + row.cells.length,
                  0,
                )
                const href = `/${mode}?offeringId=${offering.id}`
                return (
                  <article className="learning-course-row" key={offering.id}>
                    <span className="resource-icon">
                      <Icon name="book-small" size={24} inheritColor />
                    </span>
                    <div className="learning-course-copy">
                      <Link to={href}>{offering.title}</Link>
                      <p>
                        {offering.courseCode} · {offering.sectionCode} · {offering.semester}
                      </p>
                      {course.section.lead && <small>{course.section.lead.displayName}</small>}
                    </div>
                    {course.error ? (
                      <div className="learning-course-value">
                        <span className="field-error">Summary unavailable</span>
                      </div>
                    ) : mode === 'progress' ? (
                      <div className="learning-course-value">
                        <strong>{coursePercent === null ? '—' : `${coursePercent}%`}</strong>
                        <span>
                          {total
                            ? `${done} / ${total} required activities completed`
                            : 'No required activities'}
                        </span>
                        {total > 0 && (
                          <progress
                            aria-label={`${offering.title} completion`}
                            value={done}
                            max={total}
                          />
                        )}
                      </div>
                    ) : (
                      <div className="learning-course-value">
                        <strong>
                          {teacher
                            ? `${course.results?.length ?? 0} students`
                            : ownResult?.overall != null
                              ? `${ownResult.overall} / 10`
                              : 'No published grade'}
                        </strong>
                        <span>
                          {published} / {allResults} results published
                        </span>
                        {!teacher && ownResult && (
                          <Badge value={ownResult.final ? 'FINAL' : 'PROVISIONAL'} />
                        )}
                      </div>
                    )}
                    <Link className="button secondary" to={href}>
                      {mode === 'progress' ? 'View progress' : 'View results'}
                    </Link>
                  </article>
                )
              })}
            </div>
            {!visible.length && (
              <EmptyState
                title={courses.length ? 'No matching courses' : 'No course sections yet'}
                description={
                  courses.length
                    ? 'Try a different course name or code.'
                    : 'Your course summaries will appear here when you join a course section.'
                }
              />
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
