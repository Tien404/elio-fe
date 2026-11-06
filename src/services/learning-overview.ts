import { services } from '@/services'
import type { Page, OfferingView } from '@/services/course-contracts'
import type { ResultRow } from '@/services/assessment-contracts'
import { ServiceError } from '@/services/errors'

export type LearningOverviewMode = 'results' | 'progress'
type ProgressRow = Awaited<ReturnType<typeof services.personal.progress>>['rows']['items'][number]
export interface LearningCourseSummary {
  section: OfferingView
  results?: ResultRow[]
  progress?: ProgressRow[]
  error?: Error
}

async function allPages<T>(read: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await read(1)
  const items = [...first.items]
  for (let page = 2; page <= first.totalPages; page++) items.push(...(await read(page)).items)
  return items
}

export async function loadLearningOverview(mode: LearningOverviewMode) {
  const sections = (
    await allPages((page) => services.courses.list({ page, pageSize: 100 }))
  ).filter((section) => section.permissions.academic)
  const summaries: LearningCourseSummary[] = []
  // Bound concurrent requests while loading complete summaries, including later pages.
  for (let start = 0; start < sections.length; start += 4) {
    summaries.push(
      ...(await Promise.all(
        sections.slice(start, start + 4).map(async (section): Promise<LearningCourseSummary> => {
          try {
            if (mode === 'results') {
              const results = await allPages(
                async (page) =>
                  (
                    await services.assessment.gradebook(section.offering.id, {
                      page,
                      pageSize: 100,
                    })
                  ).rows,
              )
              return { section, results }
            }
            const progress = await allPages(
              async (page) =>
                (await services.personal.progress(section.offering.id, { page, pageSize: 100 }))
                  .rows,
            )
            return { section, progress }
          } catch (error) {
            if (error instanceof ServiceError && error.status === 401) throw error
            return {
              section,
              error: error instanceof Error ? error : new Error('Unable to load this course.'),
            }
          }
        }),
      )),
    )
  }
  return summaries
}
