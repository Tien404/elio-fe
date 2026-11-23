import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Field, Icon, Panel, Status, PageHeader } from '@/components/ui'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { errorMessage, ServiceError } from '@/services/errors'

export function Profile() {
  const auth = useAuth()
  const me = auth.identity!.me
  const [name, setName] = useState(me.account.displayName)
  const [version, setVersion] = useState(me.version)
  const [error, setError] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  async function save(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setSuccess('')
    setError('')
    setFieldError('')
    try {
      const result = await services.identity.updateProfile(name, version)
      auth.accept(result)
      setName(result.me.account.displayName)
      setVersion(result.me.version)
      setSuccess('Profile saved.')
      setConflict(false)
    } catch (e) {
      setError(errorMessage(e))
      if (e instanceof ServiceError) {
        setFieldError(e.fields.displayName ?? '')
        setConflict(e.status === 409 || e.status === 412)
        if (e.status === 401) auth.signedOut(e.message)
      }
    } finally {
      setPending(false)
    }
  }
  async function reload() {
    setPending(true)
    try {
      const result = await services.identity.restore()
      if (!result) {
        auth.signedOut('Sign in again.')
        return
      }
      auth.accept(result)
      setName(result.me.account.displayName)
      setVersion(result.me.version)
      setConflict(false)
      setError('')
      setSuccess('Saved profile loaded. Review it before saving.')
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }
  async function logout() {
    setPending(true)
    try {
      await auth.logout()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <PageHeader title="My profile" />
      <div className="settings-layout">
        <Panel title="Your profile" icon="profile">
          <p className="supporting-note">Manage your display name and contact details.</p>
          <form onSubmit={save}>
            {error && <Status error>{error}</Status>}
            {success && <Status>{success}</Status>}
            <div className="field-grid">
              <Field
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                error={fieldError}
              />
              <Field label="Contact information" type="email" value={me.email} readOnly />
            </div>
            <div className="actions">
              <Button type="submit" disabled={pending || conflict}>
                <Icon name="save" size={20} inheritColor />
                {pending ? 'Please wait…' : 'Save profile'}
              </Button>
              {conflict && (
                <Button tone="secondary" disabled={pending} onClick={() => void reload()}>
                  Reload saved profile
                </Button>
              )}
            </div>
          </form>
        </Panel>
        <Panel title="Account information" icon="people">
          <p>{me.account.role.toUpperCase()} account</p>
          <div className="actions">
            <Link className="button secondary" to="/change-password">
              <Icon name="lock" size={20} inheritColor />
              Change password
            </Link>
            <Button disabled={pending} onClick={() => void logout()}>
              <Icon name="logout" size={20} inheritColor />
              Logout
            </Button>
          </div>
        </Panel>
      </div>
    </>
  )
}
