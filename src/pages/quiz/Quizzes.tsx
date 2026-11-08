import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Field, Panel, DataTable, PageHeader, EmptyState } from '@/components/ui'
import {
  ActionButton as Button,
  Badge,
  Select,
  LoadState,
  Pager,
} from '@/components/workspace/WorkspaceUI'
import { SectionPicker } from '@/components/quiz/SectionPicker'
import { QuizEditor } from '@/components/quiz/QuizEditor'
import { services } from '@/services'
import { useAuth } from '@/services/auth-context'
import { useResource } from '@/services/use-resource'
import { formatInstant } from '@/services/presentation'
export function Quizzes() {
  const { identity } = useAuth(),
    teacher = identity!.me.account.role === 'INSTRUCTOR',
    [params, setParams] = useSearchParams(),
    offeringId = Number(params.get('offeringId')) || 0,
    search = params.get('search') ?? '',
    status = params.get('status') ?? '',
    page = Number(params.get('page')) || 1,
    [create, setCreate] = useState(false),
    navigate = useNavigate(),
    load = useCallback(
      () => services.quiz.list({ offeringId: offeringId || undefined, search, status, page }),
      [offeringId, search, status, page],
    ),
    result = useResource(
      load,
      `quizzes:${identity!.me.account.id}:${offeringId}:${search}:${status}:${page}`,
    ),
    sectionLoad = useCallback(
      () => (offeringId ? services.courses.get(offeringId) : Promise.resolve(null)),
      [offeringId],
    ),
    section = useResource(sectionLoad, `quiz-list-section:${identity!.me.account.id}:${offeringId}`)
  function filter(key: string, value: string) {
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      p.delete('page')
      return p
    })
  }
  return (
    <div className="course-workspace">
      <PageHeader
        title={teacher ? 'Manage quizzes' : 'Quizzes'}
        actions={
          <>
            {teacher && (
              <div className="actions">
                <Button
                  icon="add"
                  disabled={!section.data?.permissions.teach}
                  onClick={() => setCreate(true)}
                >
                  Create quiz
                </Button>
                <Link
                  className="button secondary"
                  to={`/question-bank${offeringId ? `?offeringId=${offeringId}` : ''}`}
                >
                  Question bank
                </Link>
                {!offeringId && <p>Select a section to create a quiz.</p>}
              </div>
            )}
          </>
        }
      />
      <Panel title="All quizzes" icon="quizzes">
        <div className="filters">
          <Field
            label="Search quizzes"
            value={search}
            onChange={(e) => filter('search', e.target.value)}
          />
          {teacher && (
            <Select
              label="Status"
              value={status}
              onChange={(e) => filter('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          )}
          <SectionPicker
            value={offeringId}
            change={(id) => filter('offeringId', String(id || ''))}
            all
          />
        </div>
        <LoadState {...result} retry={result.reload} />
        <LoadState {...section} retry={section.reload} />
        {result.data &&
          (result.data.items.length ? (
            <>
              <DataTable
                rows={result.data.items}
                rowKey={(v) => v.quiz.id}
                columns={[
                  {
                    label: 'Quiz',
                    render: (v) => (
                      <>
                        <Link to={`/quizzes/${v.quiz.id}`}>{v.quiz.title}</Link>
                        <small>{v.offeringLabel}</small>
                      </>
                    ),
                  },
                  {
                    label: teacher ? 'State' : 'Closes',
                    render: (v) =>
                      teacher ? <Badge value={v.quiz.status} /> : formatInstant(v.quiz.closeAt),
                  },
                  {
                    label: 'Attempts',
                    render: (v) =>
                      teacher
                        ? `${v.attemptCount} attempts${v.scheduleLocked ? ' · Schedule locked' : ''}`
                        : v.attemptId
                          ? 'Attempt started'
                          : v.canStart
                            ? 'Ready to start'
                            : 'Not available yet',
                  },
                  {
                    label: 'Actions',
                    render: (v) => (
                      <Link className="button secondary" to={`/quizzes/${v.quiz.id}`}>
                        {teacher ? 'Manage quiz' : v.attemptId ? 'View attempt' : 'View quiz'}
                      </Link>
                    ),
                  },
                ]}
              />
              <Pager
                value={result.data}
                change={(p) =>
                  setParams((prev) => {
                    prev.set('page', String(p))
                    return prev
                  })
                }
              />
            </>
          ) : (
            <EmptyState
              title="No quizzes found"
              description="Try a different course section or search term."
              icon="quizzes"
            />
          ))}
      </Panel>
      {create && offeringId > 0 && (
        <QuizEditor
          offeringId={offeringId}
          close={() => setCreate(false)}
          saved={(id) => {
            setCreate(false)
            navigate(`/quizzes/${id}`)
          }}
        />
      )}
    </div>
  )
}
