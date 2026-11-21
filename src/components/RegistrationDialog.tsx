import { useState, type FormEvent } from 'react'
import { Button, Dialog, Field, Status } from '@/components/ui'
import { http, json } from '@/api/http'
import { errorMessage } from '@/services/errors'

export function RegistrationDialog({ close }: { close(): void }) {
  const [email, setEmail] = useState(''),
    [name, setName] = useState(''),
    [password, setPassword] = useState('')
  const [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [created, setCreated] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await http('/auth/sign-up', json('POST', { email, displayName: name, password }))
      setCreated(true)
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog title="Create student account" close={close}>
      {created ? (
        <>
          <Status>Your account was created. Sign in with your email and password.</Status>
          <Button onClick={close}>Back to sign in</Button>
        </>
      ) : (
        <form onSubmit={(e) => void submit(e)}>
          {error && <Status error>{error}</Status>}
          <Field
            label="Full name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            label="Password (at least 12 characters)"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={1024}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            {pending ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      )}
    </Dialog>
  )
}
