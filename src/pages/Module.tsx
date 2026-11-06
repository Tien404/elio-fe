import { Link } from 'react-router'
import { Status } from '@/components/ui'
export function NotFound() {
  return (
    <>
      <h1>Page not found</h1>
      <Status error>This page does not exist or is no longer available.</Status>
      <Link to="/profile">Go to your profile</Link>
    </>
  )
}
