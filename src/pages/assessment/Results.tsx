import { useOfferingRoute } from '@/services/use-offering-route'
import { LearningOverview } from '@/components/personal/LearningOverview'
import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { OwnResultsTable } from '@/components/assessment/OwnResultsTable'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Dialog, Field, Panel, Status, DataTable, Icon, PageHeader } from '@/components/ui'
import { Feedback, LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import { WeightsDialog } from '@/components/assessment/WeightsDialog'
import { PublishedAssignmentResults } from '@/components/assessment/PublishedAssignmentResults'
import { apiMode, services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
import { useAction } from '@/services/use-action'
import type { ResultQuery } from '@/services/assessment-contracts'
export function Results() {
  const [params] = useSearchParams()
  const { offeringId } = useOfferingRoute()
  const { identity } = useAuth()
  const sectionId = offeringId ?? (Number(params.get('offeringId')) || undefined)
  if (identity!.me.account.role === 'ADMIN')
    return <Status error>Academic access is required to view results.</Status>
  if (apiMode && identity!.me.account.role === 'STUDENT')
    return <PublishedAssignmentResults offeringId={sectionId} />
  return apiMode || sectionId ? <ResultsDetail /> : <LearningOverview mode="results" />
}
function ResultsDetail() {
  const { prefix, offeringId: fixedId } = useOfferingRoute()
  const { identity } = useAuth(),
    teacher = identity!.me.account.role === 'INSTRUCTOR',
    [params, setParams] = useSearchParams(),
    offeringId = fixedId ?? (Number(params.get('offeringId')) || 0),
    search = params.get('search') ?? '',
    state = (params.get('state') ?? 'ALL') as ResultQuery['state'],
    activityId = Number(params.get('activityId')) || undefined,
    page = Number(params.get('page')) || 1,
    [weights, setWeights] = useState(false),
    [csv, setCsv] = useState(false),
    action = useAction()
  const sectionsLoad = useCallback(
      () => (fixedId ? Promise.resolve(null) : services.courses.list({ pageSize: 100 })),
      [fixedId],
    ),
    sections = useResource(sectionsLoad, `results-sections:${identity!.me.account.id}`),
    load = useCallback(
      () =>
        offeringId
          ? services.assessment.gradebook(offeringId, { search, state, activityId, page })
          : Promise.resolve(null),
      [offeringId, search, state, activityId, page],
    ),
    result = useResource(
      load,
      `results:${identity!.me.account.id}:${offeringId}:${search}:${state}:${activityId}:${page}`,
      { retainOnError: true },
    ),
    view = result.data
  function filter(key: string, value: string) {
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      p.delete('page')
      return p
    })
  }
  async function exportCsv() {
    const blob = await services.assessment.csv(offeringId, { search, state, activityId }),
      url = URL.createObjectURL(blob),
      link = document.createElement('a')
    link.href = url
    link.download = `elio-gradebook-${offeringId}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setCsv(false)
  }
  return (
    <WorkspaceAccessContext.Provider
      value={result.error ? { error: result.error, retry: result.reload } : undefined}
    >
      <div className="course-workspace">
        {!fixedId && !!offeringId && (
          <div className="breadcrumb">
            <Link to="/results">All course results</Link>
          </div>
        )}
        <PageHeader title={teacher ? 'Class gradebook' : 'My results'} />
        {!teacher && !result.error && view?.rows.items[0] && (
          <Panel title="Overall result" icon="publish-small">
            <p className="overall-result">
              {view.rows.items[0].overall === null
                ? 'Unavailable'
                : `${view.rows.items[0].overall} / 10`}{' '}
              · {view.rows.items[0].final ? 'Final' : 'Provisional'}
            </p>
            <p>
              {view.rows.items[0].availableWeight}% of configured {view.rows.items[0].totalWeight}%
              weight is published. Contributions are not normalized.
            </p>
          </Panel>
        )}
        <Panel
          title={teacher ? 'Student grades' : 'Published results'}
          icon="results"
          actions={
            <>
              {view?.teacher && !result.error && (
                <div className="actions">
                  <Button
                    icon="edit"
                    tone="secondary"
                    disabled={!view.writable}
                    aria-busy={result.loading}
                    onClick={() => {
                      if (!result.loading) setWeights(true)
                    }}
                  >
                    Configure weights
                  </Button>
                  <Button
                    icon="download-white"
                    disabled={action.pending}
                    onClick={() => setCsv(true)}
                  >
                    Export CSV
                  </Button>
                </div>
              )}
            </>
          }
        >
          <div className="filters">
            {!fixedId && (
              <Select
                label="Course section"
                value={offeringId || ''}
                onChange={(e) => filter('offeringId', e.target.value)}
              >
                <option value="">Select course section</option>
                {sections.data?.items
                  .filter((v) => v.permissions.academic)
                  .map((v) => (
                    <option key={v.offering.id} value={v.offering.id}>
                      {v.offering.courseCode} · {v.offering.sectionCode} · {v.offering.semester}
                    </option>
                  ))}
              </Select>
            )}
            {teacher && (
              <Field
                label="Search students"
                maxLength={200}
                value={search}
                onChange={(e) => filter('search', e.target.value)}
              />
            )}
            <Select label="Result" value={state} onChange={(e) => filter('state', e.target.value)}>
              <option value="ALL">All results</option>
              <option value="FINAL">Final</option>
              <option value="PROVISIONAL">Provisional</option>
            </Select>
            {view && !result.error && (
              <Select
                label="Activity"
                value={activityId ?? ''}
                onChange={(e) => filter('activityId', e.target.value)}
              >
                <option value="">All activities</option>
                {view.activities.map((a) => (
                  <option key={`${a.kind}:${a.activityId}`} value={a.activityId}>
                    {a.title}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <LoadState {...sections} retry={sections.reload} />
          <LoadState {...result} retry={result.reload} />
          <Feedback action={action} />
          {!offeringId && (
            <Status>
              Select a course section to view {teacher ? 'the gradebook' : 'your results'}.
            </Status>
          )}
          {view &&
            !result.error &&
            (view.rows.items.length ? (
              <>
                {!teacher ? (
                  <OwnResultsTable
                    key={`${offeringId}:${activityId}`}
                    row={view.rows.items[0]}
                    activityId={activityId}
                  />
                ) : (
                  <>
                    <DataTable
                      rows={view.rows.items}
                      rowKey={(r) => r.studentId}
                      columns={[
                        {
                          label: 'Student',
                          render: (r) => (
                            <>
                              {r.displayName}
                              <small>
                                {r.studentId} · {r.accountStatus.toLowerCase()}
                              </small>
                            </>
                          ),
                        },
                        ...view.activities
                          .filter((a) => !activityId || a.activityId === activityId)
                          .map((a) => ({
                            label: `${a.title} (${a.weight}%)`,
                            render: (r: import('@/services/assessment-contracts').ResultRow) => {
                              const c = r.cells.find(
                                (c) => c.activityId === a.activityId && c.kind === a.kind,
                              )
                              if (!c) return '—'
                              const stateLabel =
                                (
                                  {
                                    NOT_SUBMITTED: 'Not submitted',
                                    NOT_STARTED: 'Not started',
                                    IN_PROGRESS: 'In progress',
                                    WAITING_FOR_CLOSE: 'Waiting for quiz close',
                                    WAITING_FOR_RESTORE: 'Waiting for course restore',
                                    PROCESSING: 'Processing',
                                    GRADING_ERROR: 'Grading error',
                                    SUBMITTED: 'Submitted',
                                    DRAFT: 'Private draft',
                                    PUBLISHED: 'Published',
                                    CORRECTION_DRAFT: 'Published · Correction draft',
                                  } as Record<string, string>
                                )[c.state] ?? c.state
                              return (
                                <>
                                  {c.kind === 'ASSIGNMENT' ? (
                                    <Link
                                      to={`${prefix}/assignments/${a.activityId}${teacher ? '/grading' : ''}`}
                                    >
                                      {c.score === null
                                        ? stateLabel
                                        : c.specialCode === 11
                                          ? 'Absent (11)'
                                          : c.specialCode === 12
                                            ? 'Banned (12)'
                                            : `${c.score} / ${c.maxScore}`}
                                    </Link>
                                  ) : c.score === null ? (
                                    stateLabel
                                  ) : c.specialCode === 11 ? (
                                    'Absent (11)'
                                  ) : c.specialCode === 12 ? (
                                    'Banned (12)'
                                  ) : (
                                    `${c.score} / ${c.maxScore}`
                                  )}
                                  <small>{c.score !== null ? stateLabel : null}</small>
                                  <small>
                                    {c.contribution === null
                                      ? 'Unavailable'
                                      : `${c.contribution} / 10 contribution`}
                                  </small>
                                  <small>
                                    {c.isMissingZero
                                      ? 'Not submitted · Reasoned zero'
                                      : c.complete
                                        ? 'Activity completed'
                                        : 'Activity not completed'}
                                  </small>
                                </>
                              )
                            },
                          })),
                        {
                          label: 'Overall',
                          render: (r) => (
                            <>
                              {r.overall === null ? 'Unavailable' : `${r.overall} / 10`} ·{' '}
                              {r.final ? 'Final' : 'Provisional'}
                              <small>
                                {r.availableWeight}% published / {r.totalWeight}% configured
                              </small>
                            </>
                          ),
                        },
                      ]}
                    />
                    <Pager
                      value={view.rows}
                      change={(p) =>
                        setParams((prev) => {
                          prev.set('page', String(p))
                          return prev
                        })
                      }
                    />
                  </>
                )}
              </>
            ) : (
              <Status>No results match these filters.</Status>
            ))}
        </Panel>
        <details className="help-disclosure">
          <summary>
            <Icon name="info" size={20} inheritColor />
            How grades are calculated
            <Icon name="chevron-down" size={18} inheritColor />
          </summary>
          <p>
            Only published assignment grades and released quiz results contribute. Final results
            require all applicable results and a total weight of 100%. Missing or unpublished
            results stay unavailable; contributions are not normalized.
          </p>
          <p>8 / 10 × 40% + 6 / 10 × 60% = 6.8 / 10.</p>
        </details>
        {!teacher &&
          !result.error &&
          view?.rows.items.map((row) => (
            <Panel key={row.studentId} title="Published feedback" icon="info">
              {row.cells.filter((c) => c.score !== null).length ? (
                row.cells
                  .filter((c) => c.score !== null)
                  .map((c) => (
                    <div key={`${c.kind}:${c.activityId}`}>
                      <h3>{c.title}</h3>
                      <p className="material-body">{c.feedback || 'No published feedback.'}</p>
                    </div>
                  ))
              ) : (
                <p>No published feedback yet.</p>
              )}
            </Panel>
          ))}
        {weights && view && (
          <WeightsDialog
            offeringId={offeringId}
            view={view}
            close={() => {
              setWeights(false)
            }}
          />
        )}
        {csv && (
          <Dialog title="Export gradebook CSV" close={() => setCsv(false)}>
            <Feedback action={action} />
            <p>
              {activityId ? 'Only the selected activity is included.' : 'All results are included.'}{' '}
              Unpublished scores and feedback are excluded.
            </p>
            <div className="actions">
              <Button icon="cancel-dark" tone="secondary" onClick={() => setCsv(false)}>
                Cancel
              </Button>
              <Button
                icon="download-white"
                disabled={action.pending}
                onClick={() => void action.run(exportCsv)}
              >
                Download CSV
              </Button>
            </div>
          </Dialog>
        )}
      </div>
    </WorkspaceAccessContext.Provider>
  )
}
