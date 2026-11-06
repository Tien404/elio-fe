import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Field, Panel, Status, PageHeader } from '@/components/ui'
import { useAuth } from '@/services/auth-context'
import { services } from '@/services'
import { errorMessage } from '@/services/errors'

export function ChangePassword() {
  const auth = useAuth()
  const [currentPassword, setCurrent] = useState('')
  const [newPassword, setNew] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const restricted = auth.identity!.session.restricted
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirm) {
      setError('New passwords do not match.')
      return
    }
    setPending(true)
    try {
      await services.identity.changePassword({ currentPassword, newPassword })
      auth.signedOut('Password changed. All sessions were revoked. Sign in with your new password.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className={restricted ? 'restricted-page' : 'security-page'}>
      <PageHeader title="Change password" />
      <Panel title={restricted ? 'Set your own password' : 'Account security'} icon="lock">
        <p>
          {restricted
            ? 'Your temporary session only allows a password change or logout.'
            : 'Changing your password signs you out of all sessions.'}
        </p>
        <form onSubmit={submit}>
          {error && <Status error>{error}</Status>}
          <Field
            label="Current password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={1024}
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <Field
            label="New password (at least 12 characters)"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={1024}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />
          <Field
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <div className="actions">
            <Button type="submit" disabled={pending}>
              {pending ? 'Changing password…' : 'Change password'}
            </Button>
            {!restricted && (
              <Link className="button secondary" to="/profile">
                Cancel
              </Link>
            )}
            {restricted && (
              <Button
                tone="secondary"
                disabled={pending}
                onClick={async () => {
                  try {
                    await auth.logout()
                  } catch (e) {
                    setError(errorMessage(e))
                  }
                }}
              >
                Logout
              </Button>
            )}
          </div>
        </form>
      </Panel>
    </div>
  )
}
