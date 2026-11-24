import { useOfferingRoute } from '@/services/use-offering-route'
import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Field, Panel, DataTable, PageHeader, EmptyState, Status } from '@/components/ui'
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
import { quizAvailability } from '@/services/quiz-status'
import { formatInstant } from '@/services/presentation'
export function Quizzes() {
  const { prefix, offeringId: fixedId } = useOfferingRoute()
  const { identity } = useAuth(),
    academicRole = identity!.me.account.role !== 'ADMIN',
    teacher = identity!.me.account.role === 'INSTRUCTOR',
    [params, setParams] = useSearchParams(),
    offeringId = fixedId ?? (Number(params.get('offeringId')) || 0),
    search = params.get('search') ?? '',
    status = params.get('status') ?? '',
    page = Number(params.get('page')) || 1,
    [create, setCreate] = useState(false),
    navigate = useNavigate(),
    load = useCallback(
      () =>
        academicRole
          ? services.quiz.list({ offeringId: offeringId || undefined, search, status, page })
          : Promise.resolve(null),
      [academicRole, offeringId, search, status, page],
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
  if (!academicRole) return <Status error>Academic access is required to view quizzes.</Status>
  return (
    <div className="course-workspace">
      <PageHeader
        title={teacher ? 'Manage quizzes' : 'Quizzes'}
        actions={
          <>
            {teacher && (
              <div className="header-action-column">
                <div className="actions">
                  <Button
                    icon="add"
                    disabled={!section.data?.permissions.teach}
                    title={!offeringId ? 'Select a section to create a quiz.' : undefined}
                    onClick={() => setCreate(true)}
                  >
                    Create quiz
                  </Button>
                  <Link
                    className="button secondary"
                    to={
                      fixedId
                        ? `${prefix}/quizzes/question-bank`
                        : `/question-bank${offeringId ? `?offeringId=${offeringId}` : ''}`
                    }
                  >
                    Question bank
                  </Link>
                </div>
                {!offeringId && <p className="action-hint">Select a section to create a quiz.</p>}
              </div>
            )}
          </>
        }
      />
      <Panel title="All quizzes" icon="quizzes">
        <div className="filters">
          <Field
            label="Search quizzes"
            maxLength={200}
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
          {!fixedId && (
            <SectionPicker
              value={offeringId}
              change={(id) => filter('offeringId', String(id || ''))}
              all
            />
          )}
        </div>
        <LoadState {...result} retry={result.reload} />
        <LoadState {...section} retry={section.reload} />
        {result.data &&
          (result.data.items.length ? (
            <>
              <DataTable
                rows={result.data.items}
                rowKey={(v) => v.quiz.id}
                onRowClick={(v) => navigate(`${prefix}/quizzes/${v.quiz.id}`)}
                columns={[
                  {
                    label: 'Quiz',
                    render: (v) => (
                      <>
                        <Link to={`${prefix}/quizzes/${v.quiz.id}`}>{v.quiz.title}</Link>
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
                          : quizAvailability(v),
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
              icon="notfound"
            />
          ))}
      </Panel>
      {create && offeringId > 0 && (
        <QuizEditor
          offeringId={offeringId}
          close={() => setCreate(false)}
          saved={(id) => {
            setCreate(false)
            navigate(`${prefix}/quizzes/${id}`)
          }}
        />
      )}
    </div>
  )
}
