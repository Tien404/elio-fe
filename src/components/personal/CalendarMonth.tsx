import { Link } from 'react-router'
import { Icon, NavigationButton } from '@/components/ui'
import type { CalendarItem } from '@/services/contracts'
import { calendarDate, calendarKindLabel, shiftCalendarMonth } from '@/services/calendar-view'
import { formatVietnamTime } from '@/services/presentation'
export function CalendarMonth({
  anchor,
  events,
  change,
  today = calendarDate(),
}: {
  anchor: string
  events: CalendarItem[]
  change(date: string): void
  today?: string
}) {
  const month = anchor.slice(0, 7),
    first = new Date(`${month}-01T00:00:00Z`),
    offset = (first.getUTCDay() + 6) % 7,
    days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const eventDays = [...new Set(events.map((event) => calendarDate(event.at)))].sort()
  function move(delta: number) {
    change(shiftCalendarMonth(anchor, delta))
  }
  return (
    <>
      <div className="calendar-heading">
        <h3>
          {first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </h3>
        <div className="actions">
          <NavigationButton direction="previous" label="Previous month" onClick={() => move(-1)} />
          <NavigationButton direction="next" label="Next month" onClick={() => move(1)} />
        </div>
      </div>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Monthly calendar">
        <table className="calendar-month">
          <thead>
            <tr>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <th key={d} scope="col">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil((offset + days) / 7) }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, day) => {
                  const n = week * 7 + day - offset + 1,
                    key = `${month}-${String(n).padStart(2, '0')}`,
                    dayEvents = events.filter((event) => calendarDate(event.at) === key)
                  return (
                    <td
                      key={day}
                      className={key === today && n > 0 && n <= days ? 'is-today' : undefined}
                    >
                      {n > 0 && n <= days && (
                        <>
                          <span
                            className="calendar-day-number"
                            aria-current={key === today ? 'date' : undefined}
                          >
                            {n}
                          </span>
                          {dayEvents.length > 0 && (
                            <a
                              className="calendar-day-jump"
                              href={`#calendar-agenda-${key}`}
                              aria-label={`${key}: ${dayEvents.length} activities`}
                              aria-current={key === today ? 'date' : undefined}
                            >
                              {n}
                              <span className="calendar-event-dot" />
                            </a>
                          )}
                          <div className="calendar-event-links">
                            {dayEvents.map((e) => (
                              <Link key={e.id} to={e.targetUri}>
                                {formatVietnamTime(e.at)} · {e.title}
                                {e.kind !== 'ASSIGNMENT_DUE' && ` · ${calendarKindLabel[e.kind]}`}
                              </Link>
                            ))}
                          </div>
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length > 0 && (
        <div className="calendar-mobile-agenda">
          {eventDays.map((day) => (
            <section key={day} id={`calendar-agenda-${day}`}>
              <h4>
                {new Date(`${day}T00:00:00+07:00`).toLocaleDateString('en-GB', {
                  timeZone: 'Asia/Ho_Chi_Minh',
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </h4>
              {events
                .filter((event) => calendarDate(event.at) === day)
                .map((event) => (
                  <div className="resource-row" key={event.id}>
                    <span className="resource-icon">
                      <Icon
                        name={event.kind === 'ASSIGNMENT_DUE' ? 'assignments' : 'quizzes'}
                        size={20}
                      />
                    </span>
                    <div className="resource-copy">
                      <Link to={event.targetUri}>{event.title}</Link>
                      <p>
                        {formatVietnamTime(event.at)} ·{' '}
                        {event.type ?? calendarKindLabel[event.kind]}
                      </p>
                    </div>
                  </div>
                ))}
            </section>
          ))}
        </div>
      )}
    </>
  )
}
