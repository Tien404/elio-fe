import { useOfferingRoute } from '@/services/use-offering-route'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Panel, DataTable, Field, Status, PageHeader, EmptyState } from '@/components/ui'
import {
  ActionButton as Button,
  Select,
  Pager,
  LoadState,
} from '@/components/workspace/WorkspaceUI'
import { SectionPicker } from '@/components/quiz/SectionPicker'
import { QuestionEditor } from '@/components/quiz/QuestionEditor'
import { services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import type { QuestionItem } from '@/services/quiz-contracts'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function QuestionBank() {
  const { prefix, offeringId: fixedId } = useOfferingRoute()
  const { identity } = useAuth(),
    teacher = identity!.me.account.role === 'INSTRUCTOR',
    [params, setParams] = useSearchParams(),
    offeringId = fixedId ?? (Number(params.get('offeringId')) || 0),
    search = params.get('search') ?? '',
    kind = params.get('kind') ?? '',
    page = Number(params.get('page')) || 1,
    [editor, setEditor] = useState<QuestionItem | null | undefined>(),
    load = useCallback(
      () =>
        teacher && offeringId
          ? services.quiz.bank(offeringId, { search, kind, page })
          : Promise.resolve(null),
      [teacher, offeringId, search, kind, page],
    ),
    result = useResource(
      load,
      `bank:${identity!.me.account.id}:${offeringId}:${search}:${kind}:${page}`,
      { retainOnError: true },
    ),
    sectionLoad = useCallback(
      () => (offeringId ? services.courses.get(offeringId) : Promise.resolve(null)),
      [offeringId],
    ),
    section = useResource(sectionLoad, `bank-scope:${identity!.me.account.id}:${offeringId}`)
  function filter(key: string, value: string) {
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
      p.delete('page')
      return p
    })
  }
  if (!teacher) return <Status error>Question bank requires current teaching access.</Status>
  return (
    <div className="course-workspace">
      <PageHeader
        title="Question bank"
        actions={
          <>
            {' '}
            <div className="actions">
              <Button
                icon="add"
                disabled={!section.data?.permissions.teach}
                onClick={() => setEditor(null)}
              >
                Create question
              </Button>
              <Link
                className="button secondary"
                to={
                  fixedId
                    ? `${prefix}/quizzes`
                    : `/quizzes${offeringId ? `?offeringId=${offeringId}` : ''}`
                }
              >
                Manage quizzes
              </Link>
            </div>
          </>
        }
      />

      <LoadState {...result} retry={result.reload} />
      <LoadState {...section} retry={section.reload} />
      <WorkspaceAccessContext.Provider
        value={
          result.error
            ? { error: result.error, retry: result.reload }
            : section.error
              ? { error: section.error, retry: section.reload }
              : undefined
        }
      >
        <div
          className={
            result.error || section.error ? 'offering-content permission-lost' : 'offering-content'
          }
        >
          <Panel title="Questions" icon="quizzes">
            <div className="filters">
              {!fixedId && (
                <SectionPicker
                  value={offeringId}
                  change={(id) => filter('offeringId', String(id || ''))}
                />
              )}
              <Field
                label="Search questions"
                maxLength={200}
                value={search}
                onChange={(e) => filter('search', e.target.value)}
              />
              <Select
                label="Question type"
                value={kind}
                onChange={(e) => filter('kind', e.target.value)}
              >
                <option value="">All types</option>
                <option value="SINGLE_CHOICE">Multiple choice</option>
                <option value="TRUE_FALSE">True / False</option>
              </Select>
            </div>
            {!offeringId ? (
              <Status>Select a course section to manage its question bank.</Status>
            ) : (
              result.data &&
              (result.data.items.length ? (
                <>
                  <DataTable
                    rows={result.data.items}
                    rowKey={(q) => q.id}
                    columns={[
                      { label: 'Question', render: (q) => q.prompt },
                      {
                        label: 'Type',
                        render: (q) =>
                          q.kind === 'SINGLE_CHOICE'
                            ? 'Multiple choice · One correct'
                            : 'True / False',
                      },
                      { label: 'Score', render: (q) => q.points },
                      {
                        label: 'Actions',
                        render: (q) => (
                          <Button
                            icon="quiz-edit-white"
                            disabled={!section.data?.permissions.teach}
                            onClick={() => setEditor(q)}
                          >
                            Edit question
                          </Button>
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
                  title="No questions found"
                  description="Try a different course section or search term."
                  icon="quizzes"
                />
              ))
            )}
          </Panel>
          {editor !== undefined && offeringId > 0 && (
            <QuestionEditor
              offeringId={offeringId}
              question={editor ?? undefined}
              close={() => setEditor(undefined)}
            />
          )}
        </div>
      </WorkspaceAccessContext.Provider>
    </div>
  )
}
