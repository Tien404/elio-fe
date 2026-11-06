import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/services/auth-context'
import { errorMessage } from '@/services/errors'
import { Button, Dialog, Field, Icon, Status } from '@/components/ui'

export function Login() {
  const auth = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [help, setHelp] = useState(false)
  const requested = (location.state as { from?: string } | null)?.from
  const target =
    requested?.startsWith('/') &&
    !requested.startsWith('//') &&
    requested !== '/login' &&
    requested !== '/change-password'
      ? requested
      : '/dashboard'
  if (auth.identity)
    return <Navigate to={auth.identity.session.restricted ? '/change-password' : target} replace />
  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await auth.login({ email, password })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="login-page">
      <section className="introduction" aria-label="Welcome to ELIO">
        <img className="institution-image" src="/assets/institution.png" alt="" />
        <div className="intro-brand brand">
          <Icon name="mark-white" size={32} />
          ELIO
        </div>
        <div className="intro-copy">
          <p>Your university learning workspace</p>
          <h1>
            A clearer path to
            <br />
            your next chapter.
          </h1>
          <p>Your courses, activities and progress, together in one calm place. Welcome to ELIO.</p>
        </div>
        <small>ELIO · Enhanced Learning Integration &amp; Organization Platform</small>
      </section>
      <section className="login-content">
        <button
          className="text-button support"
          onClick={(event) => {
            event.currentTarget.focus()
            setHelp(true)
          }}
        >
          Contact administrator
        </button>
        <form onSubmit={submit} className="login-form">
          <div>
            <h1>Get started</h1>
            <p>Sign in with your institutional account.</p>
          </div>
          {auth.notice && <Status>{auth.notice}</Status>}
          {auth.restoreError && (
            <Status error>
              {auth.restoreError}{' '}
              <Button tone="secondary" onClick={() => void auth.refresh()}>
                Retry session restore
              </Button>
            </Status>
          )}
          {error && <Status error>{error}</Status>}
          <Field
            label="Email"
            type="email"
            autoComplete="username"
            maxLength={254}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="password-field">
            <Field
              label="Password"
              type={visible ? 'text' : 'password'}
              autoComplete="current-password"
              maxLength={1024}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="reveal"
              aria-label={visible ? 'Hide password' : 'Show password'}
              aria-pressed={visible}
              onClick={() => setVisible(!visible)}
            >
              <Icon name="eye" />
            </button>
          </div>
          <Button type="submit" disabled={pending || auth.loading}>
            {pending || auth.loading ? 'Please wait…' : 'Sign in'}
          </Button>
        </form>
        <small>© 2026 ELIO · Privacy policy · Terms of use</small>
      </section>
      {help && (
        <Dialog title="Account assistance" close={() => setHelp(false)}>
          <p>
            ELIO accounts are issued by your institution. Contact your course administrator for
            account access, a password reset or help with a locked account.
          </p>
          <Button onClick={() => setHelp(false)}>Back to sign in</Button>
        </Dialog>
      )}
    </div>
  )
}
