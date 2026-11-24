import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { Offering } from '@/services/contracts'
import { Badge } from '@/components/workspace/WorkspaceUI'

const COVER_COUNT = 9

function courseCoverUrl(offeringId: number) {
  const index = (Math.abs(offeringId) % COVER_COUNT) + 1
  return `/assets/covers/cover-${index}.webp`
}

export function OfferingCard({
  offering,
  children,
  actions,
}: {
  offering: Offering
  children?: ReactNode
  actions?: ReactNode
}) {
  return (
    <article className="course-card offering-card">
      <Link className="offering-card-main" to={`/offerings/${offering.id}`}>
        <div
          className="course-cover"
          style={{ backgroundImage: `url("${courseCoverUrl(offering.id)}")` }}
        >
          <div>
            <span>{offering.semester}</span>
            <span>{offering.courseCode}</span>
            <span>{offering.sectionCode}</span>
          </div>
        </div>
        <div className="offering-card-title">
          <strong>{offering.title}</strong>
          <Badge value={offering.status} />
        </div>
        {children}
      </Link>
      {actions && <div className="offering-card-actions">{actions}</div>}
    </article>
  )
}
