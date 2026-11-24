import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button, Field, Panel, PageHeader, Icon, EmptyState } from '@/components/ui'
import { Badge, Feedback, LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAction } from '@/services/use-action'
import { formatInstant } from '@/services/presentation'
export function Inbox() {
  const [params, setParams] = useSearchParams(),
    state = params.get('state') ?? 'ALL',
    search = params.get('search') ?? '',
    page = Number(params.get('page')) || 1,
    offeringId = Number(params.get('offeringId')) || undefined,
    navigate = useNavigate(),
    [unavailable, setUnavailable] = useState(false),
    action = useAction(),
    load = useCallback(
      () => services.personal.inbox({ state, search, page, offeringId }),
      [state, search, page, offeringId],
    ),
    r = useResource(load, `inbox:${params}`),
    sectionLoad = useCallback(() => services.courses.list({ pageSize: 100 }), []),
    sections = useResource(sectionLoad, 'inbox-sections')
  function filter(k: string, v: string) {
    setParams((p) => {
      p.set(k, v)
      p.delete('page')
      return p
    })
  }
  return (
    <div className="course-workspace">
      <PageHeader title="Notifications" />
      <Panel title="Your notifications" icon="messages">
        <div className="filters">
          <Field
            label="Search notifications"
            maxLength={200}
            value={search}
            onChange={(e) => filter('search', e.target.value)}
          />
          <Select
            label="Read state"
            value={state}
            onChange={(e) => filter('state', e.target.value)}
          >
            <option value="ALL">All notifications</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
          </Select>
          <Select
            label="Course section"
            value={offeringId ?? ''}
            onChange={(event) => filter('offeringId', event.target.value)}
          >
            <option value="">All course sections</option>
            {sections.data?.items.map(({ offering }) => (
              <option key={offering.id} value={offering.id}>
                {offering.courseCode} · {offering.sectionCode} · {offering.semester}
              </option>
            ))}
          </Select>
        </div>
        <LoadState {...sections} retry={sections.reload} />
        <LoadState {...r} retry={r.reload} />
        <Feedback action={action} />
        {r.data && !r.error && (
          <>
            <p>{r.data.unread} unread</p>
            <div className="notification-list">
              {r.data.rows.items.map((notification) => {
                function openNotification() {
                  if (action.pending) return
                  void action.run(
                    async () => {
                      if (notification.status !== 'READ') {
                        await services.personal.read(notification.id).catch(() => undefined)
                      }
                      return services.personal.destination(notification)
                    },
                    (destination) => {
                      if (destination.href) navigate(destination.href)
                      else setUnavailable(true)
                    },
                  )
                }
                return (
                  <article
                    className={`notification-row ${notification.status.toLowerCase()} clickable`}
                    key={notification.id}
                    tabIndex={0}
                    role="button"
                    aria-label={notification.preview}
                    onClick={openNotification}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openNotification()
                      }
                    }}
                  >
                    <span className="resource-icon">
                      <Icon name="notifications" size={22} inheritColor />
                    </span>
                    <div className="resource-copy">
                      <p>{notification.preview}</p>
                      <div className="notification-meta">
                        <time dateTime={notification.createdAt}>
                          {formatInstant(notification.createdAt)}
                        </time>
                        <Badge value={notification.status} />
                      </div>
                    </div>
                    {notification.status !== 'READ' && (
                      <div
                        className="actions"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Button
                          tone="secondary"
                          disabled={action.pending}
                          onClick={() =>
                            void action.run(
                              () => services.personal.read(notification.id),
                              () => {
                                if (
                                  state === 'UNREAD' &&
                                  page > 1 &&
                                  r.data?.rows.items.length === 1
                                )
                                  setParams((current) => {
                                    current.set('page', String(page - 1))
                                    return current
                                  })
                              },
                              'Marked as read.',
                            )
                          }
                        >
                          Mark as read
                        </Button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
            {!r.data.rows.totalItems && (
              <EmptyState
                title="You're all caught up"
                description="No notifications match these filters."
                icon="notifications"
              />
            )}
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
      </Panel>
      {unavailable && (
        <Panel title="Destination unavailable" icon="info">
          <p>You cannot access this destination. No protected content is shown.</p>
          <Button onClick={() => setUnavailable(false)}>Back to notifications</Button>
        </Panel>
      )}
    </div>
  )
}
