import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { JoinDialog } from '@/components/workspace/JoinDialog'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/services/auth-context'
import { canAccess, pages } from '@/services/navigation'
import { Button, Dialog, Icon } from '@/components/ui'
import { LoadingBoundary } from '@/components/LoadingBoundary'

const mobileQuery = '(max-width: 760px)'
function subscribeMobile(change: () => void) {
  const query = window.matchMedia(mobileQuery)
  query.addEventListener('change', change)
  return () => query.removeEventListener('change', change)
}

export function Shell() {
  const { identity } = useAuth()
  const me = identity!.me
  const summaryLoad = useCallback(() => services.personal.summary(), [])
  const summary = useResource(summaryLoad, `shell:${me.account.id}`)
  const [menu, setMenu] = useState(false)
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(mobileQuery).matches,
    () => false,
  )
  const drawerOpen = mobile && menu
  const [query, setQuery] = useState('')
  const [join, setJoin] = useState(false)
  const [assistance, setAssistance] = useState(false)
  const sidebarRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  function closeMenu() {
    setMenu(false)
    requestAnimationFrame(() => menuRef.current?.focus())
  }
  useEffect(() => {
    if (!drawerOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sidebarRef.current?.querySelector<HTMLButtonElement>('.sidebar-close')?.focus()
    return () => {
      document.body.style.overflow = previous
    }
  }, [drawerOpen])
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    if (!drawerOpen) document.getElementById('main')?.focus()
  }, [location.pathname, drawerOpen])
  const nav = pages
    .filter(
      (p) =>
        !p.path.includes(':') &&
        !['/notifications', '/offerings/new'].includes(p.path) &&
        (p.path !== '/courses' || me.account.role === 'ADMIN') &&
        canAccess(p, me),
    )
    .sort((a, b) => (a.path === '/calendar' ? 1 : b.path === '/calendar' ? -1 : 0))
  const initials = me.account.displayName
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {drawerOpen && <div className="sidebar-backdrop" aria-hidden="true" />}
      <aside
        className={`sidebar ${menu ? 'is-open' : ''}`}
        aria-label="Main navigation"
        id="app-navigation"
        ref={sidebarRef}
        role={drawerOpen ? 'dialog' : undefined}
        aria-modal={drawerOpen ? true : undefined}
        onKeyDown={(event) => {
          if (!drawerOpen) return
          if (event.key === 'Escape') {
            event.preventDefault()
            closeMenu()
            return
          }
          if (event.key !== 'Tab') return
          const items = sidebarRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not(:disabled)',
          )
          if (!items?.length) return
          const first = items[0],
            last = items[items.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }}
      >
        <Button
          tone="secondary"
          className="button secondary sidebar-close"
          aria-label="Close navigation"
          onClick={closeMenu}
        >
          <Icon name="close" />
        </Button>
        <Link to="/dashboard" className="brand" onClick={() => setMenu(false)}>
          <Icon name="mark" size={44} />
          ELIO
        </Link>
        <nav>
          {nav.map((page, i) => (
            <div key={page.path}>
              {i === 1 && (
                <p className="nav-label">
                  {me.account.role === 'ADMIN'
                    ? 'Administration'
                    : me.account.role === 'INSTRUCTOR'
                      ? 'Teaching workspace'
                      : 'My learning'}
                </p>
              )}
              {page.path === '/calendar' && <p className="nav-label">Connect</p>}
              {page.path === '/quizzes' && location.pathname.startsWith('/quiz-attempts/') ? (
                <Link
                  to={page.path}
                  className="active"
                  aria-current="page"
                  onClick={() => setMenu(false)}
                >
                  <Icon name="quiz-nav-active" />
                  Quizzes
                </Link>
              ) : (
                <NavLink to={page.path} onClick={() => setMenu(false)}>
                  <Icon
                    name={
                      page.path === '/results' && me.account.role === 'INSTRUCTOR'
                        ? 'gradebook'
                        : page.icon === 'quizzes' && location.pathname.startsWith(page.path)
                          ? 'quiz-nav-active'
                          : page.icon
                    }
                  />
                  {page.path === '/results' && me.account.role === 'INSTRUCTOR'
                    ? 'Gradebook'
                    : page.title}
                </NavLink>
              )}
            </div>
          ))}
        </nav>
        <NavLink className="account-card" to="/profile" onClick={() => setMenu(false)}>
          <span className="avatar">{initials}</span>
          <span className="account-details">
            <strong>{me.account.displayName}</strong>
            <small>{me.account.role.toLowerCase()}</small>
          </span>
        </NavLink>
      </aside>
      <div className="workspace" inert={drawerOpen}>
        <header className="header">
          <Button
            tone="secondary"
            className="menu-button button secondary"
            ref={menuRef}
            aria-controls="app-navigation"
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            Menu
          </Button>
          <form
            className="search"
            onSubmit={(event) => {
              event.preventDefault()
              navigate(`/offerings?q=${encodeURIComponent(query)}`)
            }}
          >
            <Icon name="search" size={16} />
            <input
              aria-label="Search your course sections"
              placeholder="Search your course sections"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
          <div className="header-actions">
            <Link
              className="icon-button"
              to="/notifications"
              aria-label={`Notifications${summary.data ? ` · ${summary.data.unread} unread` : ''}`}
            >
              <Icon name="notifications" />
              {!!summary.data?.unread && (
                <span className="unread-count">{summary.data.unread}</span>
              )}
            </Link>
            {me.account.role === 'INSTRUCTOR' && me.canCreateCourse && (
              <Link className="button primary" to="/offerings/new">
                Create course section
              </Link>
            )}
            {me.account.role === 'STUDENT' && (
              <Button onClick={() => setJoin(true)}>
                <Icon name="join" size={16} />
                Join by code
              </Button>
            )}
          </div>
        </header>
        <main id="main" tabIndex={-1} key={location.pathname}>
          <LoadingBoundary>
            <Outlet />
          </LoadingBoundary>
        </main>
        <footer>
          <span>ELIO · Enhanced Learning Integration &amp; Organization Platform</span>
          <button
            className="text-button"
            onClick={(event) => {
              event.currentTarget.focus()
              setAssistance(true)
            }}
          >
            Account assistance
          </button>
        </footer>
      </div>
      {assistance && (
        <Dialog title="Account assistance" close={() => setAssistance(false)}>
          <p>
            Your account is managed by your institution. Contact your administrator for email
            changes, access issues, password resets or account status.
          </p>
          <Button onClick={() => setAssistance(false)}>Close</Button>
        </Dialog>
      )}
      {join && (
        <JoinDialog
          close={() => setJoin(false)}
          offeringId={Number(location.pathname.match(/^\/offerings\/(\d+)/)?.[1]) || undefined}
        />
      )}
    </div>
  )
}
