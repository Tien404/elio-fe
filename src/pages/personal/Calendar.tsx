import { CalendarMonth } from '@/components/personal/CalendarMonth'
import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DataTable, Field, Panel, EmptyState, PageHeader, Icon } from '@/components/ui'
import { Badge, LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { formatInstant } from '@/services/presentation'
import {
  calendarDate,
  validCalendarDate,
  loadCalendarMonth,
  calendarKindLabel,
} from '@/services/calendar-view'
export function Calendar() {
  const [params, setParams] = useSearchParams(),
    from = params.get('from') ?? '',
    to = params.get('to') ?? '',
    kind = params.get('kind') ?? 'ALL',
    display = params.get('view') === 'list' ? 'list' : 'calendar',
    today = calendarDate(),
    requestedDate = params.get('date') ?? params.get('from') ?? today,
    selectedDate = validCalendarDate(requestedDate) ? requestedDate : today,
    offeringId = Number(params.get('offeringId')) || undefined,
    page = Number(params.get('page')) || 1,
    sectionLoad = useCallback(() => services.courses.list({ pageSize: 100 }), []),
    sections = useResource(sectionLoad, 'calendar-sections'),
    load = useCallback(
      () =>
        display === 'calendar'
          ? loadCalendarMonth(selectedDate, kind, offeringId)
          : services.personal.calendar({ from, to, kind, offeringId, page }),
      [display, selectedDate, from, to, kind, offeringId, page],
    ),
    r = useResource(
      load,
      `calendar:${display}:${selectedDate}:${from}:${to}:${kind}:${offeringId}:${page}`,
    )
  function chooseDate(value: string) {
    setParams((previous) => {
      previous.set('date', value || today)
      previous.delete('from')
      previous.delete('to')
      previous.delete('page')
      return previous
    })
  }
  function filter(k: string, v: string) {
    setParams((p) => {
      p.set(k, v)
      p.delete('page')
      return p
    })
  }
  return (
    <div className="course-workspace">
      <PageHeader
        title="Calendar"
        actions={
          <div className="course-view-switch" role="group" aria-label="Calendar display">
            {(['calendar', 'list'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={display === mode}
                onClick={() =>
                  setParams(
                    (previous) => {
                      previous.set('view', mode)
                      return previous
                    },
                    { replace: true },
                  )
                }
              >
                <Icon
                  name={mode === 'calendar' ? 'calendar' : 'view-list'}
                  size={18}
                  inheritColor
                />
                {mode === 'calendar' ? 'Month' : 'Deadlines'}
              </button>
            ))}
          </div>
        }
      />
      <Panel
        title={display === 'calendar' ? 'Monthly activities' : 'Upcoming deadlines'}
        icon="calendar"
      >
        <div className="filters">
          {display === 'calendar' ? (
            <Field
              label="Go to date"
              type="date"
              value={selectedDate}
              onInput={(event) => chooseDate(event.currentTarget.value)}
            />
          ) : (
            <>
              <Field
                label="From date"
                type="date"
                value={from}
                onInput={(e) => filter('from', e.currentTarget.value)}
              />
              <Field
                label="Through date"
                type="date"
                value={to}
                onInput={(e) => filter('to', e.currentTarget.value)}
              />
            </>
          )}
          <Select
            label="Activity type"
            value={kind}
            onChange={(e) => filter('kind', e.target.value)}
          >
            <option value="ALL">All activities</option>
            <option value="ASSIGNMENT_DUE">Assignment due</option>
            <option value="QUIZ_OPEN">Quiz opens</option>
            <option value="QUIZ_CLOSE">Quiz closes</option>
          </Select>
          <Select
            label="Course section"
            value={offeringId ?? ''}
            onChange={(e) => filter('offeringId', e.target.value)}
          >
            <option value="">All sections</option>
            {sections.data?.items.map(({ offering: o }) => (
              <option value={o.id} key={o.id}>
                {o.courseCode} · {o.sectionCode} · {o.semester}
              </option>
            ))}
          </Select>
        </div>
        <LoadState {...sections} retry={sections.reload} />
        <LoadState {...r} retry={r.reload} />
        {r.data && !r.error && (
          <>
            {display === 'calendar' ? (
              <CalendarMonth
                anchor={selectedDate}
                today={calendarDate(r.data.serverNow)}
                events={r.data.items}
                change={chooseDate}
              />
            ) : (
              <DataTable
                rows={r.data.items}
                rowKey={(e) => e.id}
                columns={[
                  { label: 'Activity', render: (e) => <Link to={e.targetUri}>{e.title}</Link> },
                  {
                    label: 'Course section',
                    render: (e) => <Link to={`/offerings/${e.offeringId}`}>{e.section}</Link>,
                  },
                  {
                    label: 'Type',
                    render: (e) => e.type ?? calendarKindLabel[e.kind],
                  },
                  { label: 'Time', render: (e) => formatInstant(e.at) },
                  { label: 'Status', render: (e) => <Badge value={e.status} /> },
                ]}
              />
            )}
            {display === 'list' && !r.data.totalItems && (
              <EmptyState
                title="No activities scheduled"
                description="Try a different date range or course section."
                icon="notfound"
              />
            )}
            {display === 'list' && (
              <Pager
                value={r.data}
                change={(p) =>
                  setParams((s) => {
                    s.set('page', String(p))
                    return s
                  })
                }
              />
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
