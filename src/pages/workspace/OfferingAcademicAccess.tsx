import { Outlet } from 'react-router'
import { Status } from '@/components/ui'
import { useOffering } from './offering-context'

export function OfferingAcademicAccess() {
  const offering = useOffering()
  if (!offering.view.permissions.academic) {
    return <Status error>Academic access to this course section is required.</Status>
  }
  return <Outlet context={offering} />
}
