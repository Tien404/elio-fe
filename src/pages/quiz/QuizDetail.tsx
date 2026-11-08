import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Panel, Dialog, Status } from '@/components/ui'
import {
  ActionButton as Button,
  LoadState,
  Feedback,
  Badge,
  ConfirmDialog,
} from '@/components/workspace/WorkspaceUI'
import { QuizEditor } from '@/components/quiz/QuizEditor'
import { QuizPreview } from '@/components/quiz/QuizPreview'
import { QuizNav } from '@/components/quiz/QuizNav'
import { services } from '@/services'
import { useQuiz } from '@/services/use-quiz'
import { useAction } from '@/services/use-action'
import { formatInstant } from '@/services/presentation'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function QuizDetail() {
  const result = useQuiz(),
    view = result.data,
    [edit, setEdit] = useState(false),
    [preview, setPreview] = useState(false),
    [start, setStart] = useState(false),
    [transition, setTransition] = useState<{ kind: 'publish' | 'archive'; version: number }>(),
    action = useAction(),
    navigate = useNavigate()
  return (
    <div className="course-workspace">
      <h1>Quiz details</h1>
      <LoadState {...result} retry={result.reload} />
      {view && (
        <WorkspaceAccessContext.Provider
          value={result.error ? { error: result.error, retry: result.reload } : undefined}
        >
          <div className={result.error ? 'offering-content permission-lost' : 'offering-content'}>
            <QuizNav view={view} />
            <Panel title={view.quiz.title} icon="book-small">
              <p className="activity-meta">
                <Badge value={view.quiz.status} /> · {view.quiz.questionCount} questions ·{' '}
                {view.quiz.maxScore} points · {view.weight}% weight ·{' '}
                {view.mandatory ? 'Required' : 'Optional'}
              </p>
              <dl className="assessment-schedule">
                <div>
                  <dt>Open time</dt>
                  <dd>{formatInstant(view.quiz.openAt)}</dd>
                </div>
                <div>
                  <dt>Close time</dt>
                  <dd>{formatInstant(view.quiz.closeAt)}</dd>
                </div>
                <div>
                  <dt>Duration</dt>
                  <dd>{view.quiz.durationMinutes} minutes · One attempt per student</dd>
                </div>
              </dl>
              <Feedback action={action} />
              {view.teacher ? (
                <div className="actions">
                  {view.writable && (
                    <>
                      <Button
                        icon="edit"
                        tone="secondary"
                        disabled={view.scheduleLocked}
                        onClick={() => setEdit(true)}
                      >
                        {view.quiz.status === 'DRAFT' ? 'Edit quiz' : 'Edit schedule'}
                      </Button>
                      {view.quiz.status === 'DRAFT' && (
                        <Button
                          icon="publish-small"
                          tone="secondary"
                          onClick={() =>
                            setTransition({ kind: 'publish', version: view.quiz.version })
                          }
                        >
                          Publish quiz
                        </Button>
                      )}
                      <Button
                        icon="archive-white"
                        danger
                        onClick={() =>
                          setTransition({ kind: 'archive', version: view.quiz.version })
                        }
                      >
                        Archive quiz
                      </Button>
                    </>
                  )}
                  <Button icon="preview" tone="secondary" onClick={() => setPreview(true)}>
                    Preview
                  </Button>
                  <Link className="button secondary" to={`/quizzes/${view.quiz.id}/attempts`}>
                    Attempts and results
                  </Link>
                </div>
              ) : (
                <>
                  <Status>
                    The timer continues if you leave or refresh. Save your answers before
                    submitting.
                  </Status>
                  <div className="actions">
                    {view.attemptId ? (
                      <Link className="button primary" to={`/quiz-attempts/${view.attemptId}`}>
                        View my attempt
                      </Link>
                    ) : (
                      <Button
                        icon="quiz-next"
                        disabled={!view.canStart}
                        onClick={() => setStart(true)}
                      >
                        Start quiz…
                      </Button>
                    )}
                    <Button
                      icon="refresh"
                      tone="secondary"
                      disabled={action.pending}
                      onClick={() =>
                        void action.run(
                          () => services.quiz.own(view.quiz.id),
                          (v) => {
                            if (v) navigate(`/quiz-attempts/${v.attempt.id}`)
                          },
                          'Existing attempt checked. If none exists, review the start window before starting.',
                        )
                      }
                    >
                      Check existing attempt
                    </Button>
                  </div>
                </>
              )}
            </Panel>
            {view.teacher && (
              <Panel title={view.scheduleLocked ? 'Schedule locked' : 'Quiz settings'} icon="info">
                <p>
                  {view.scheduleLocked
                    ? 'The first attempt locks open/close time and duration.'
                    : 'Questions are fixed after publication. You can edit the schedule until the first attempt.'}
                </p>
              </Panel>
            )}
            {edit && (
              <QuizEditor
                offeringId={view.quiz.offeringId}
                view={view}
                close={() => setEdit(false)}
                saved={() => setEdit(false)}
              />
            )}{' '}
            {preview && view.teacherContent && (
              <QuizPreview
                title={view.quiz.title}
                questions={view.teacherContent.questions}
                close={() => setPreview(false)}
              />
            )}{' '}
            {transition && (
              <ConfirmDialog
                title={transition.kind === 'publish' ? 'Publish quiz?' : 'Archive quiz?'}
                confirm={transition.kind === 'publish' ? 'Publish immutable copy' : 'Archive quiz'}
                close={() => setTransition(undefined)}
                run={() =>
                  transition.kind === 'publish'
                    ? services.quiz.publish(view.quiz.id, transition.version)
                    : services.quiz.archive(view.quiz.id, transition.version)
                }
                danger={transition.kind === 'archive'}
              >
                <p>
                  {transition.kind === 'publish'
                    ? 'Copy the current bank questions, options, correct keys, explanations and selected points. Published copies cannot be edited.'
                    : 'Archive is blocked until all existing attempts finalize successfully. Published copies and attempt history are preserved.'}
                </p>
              </ConfirmDialog>
            )}
            {start && (
              <Dialog
                title={`Start ${view.quiz.title}?`}
                icon="book-small"
                close={() => setStart(false)}
              >
                <Feedback action={action} />
                <p>
                  One attempt only. Duration: {view.quiz.durationMinutes} minutes. Close time:{' '}
                  {formatInstant(view.quiz.closeAt)}. Reloading resumes the original attempt and end
                  time.
                </p>
                <div className="actions">
                  <Button
                    icon="cancel-dark"
                    tone="secondary"
                    disabled={action.pending}
                    onClick={() => setStart(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    icon="quiz-next"
                    disabled={action.pending}
                    onClick={() =>
                      void action.run(
                        () => services.quiz.start(view.quiz.id),
                        (v) => navigate(`/quiz-attempts/${v.attempt.id}`),
                      )
                    }
                  >
                    Start attempt
                  </Button>
                  <Button
                    icon="refresh"
                    tone="secondary"
                    disabled={action.pending}
                    onClick={() =>
                      void action.run(
                        () => services.quiz.own(view.quiz.id),
                        (v) => {
                          if (v) navigate(`/quiz-attempts/${v.attempt.id}`)
                        },
                        'Existing attempt checked.',
                      )
                    }
                  >
                    Check existing attempt
                  </Button>
                </div>
              </Dialog>
            )}
          </div>
        </WorkspaceAccessContext.Provider>
      )}
    </div>
  )
}
