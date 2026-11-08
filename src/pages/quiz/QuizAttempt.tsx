import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Panel, Dialog, Status, DataTable, NavigationButton, Icon } from '@/components/ui'
import { ActionButton as Button, Feedback, LoadState } from '@/components/workspace/WorkspaceUI'
import { AttemptResult } from '@/components/quiz/AttemptResult'
import { services } from '@/services'
import { useAttempt } from '@/services/use-quiz'
import { AnswerQueue } from '@/services/answer-queue'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'
import { useCountdown } from '@/services/use-countdown'
import { formatInstant } from '@/services/presentation'
import type { AttemptView } from '@/services/quiz-contracts'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function QuizAttempt() {
  const result = useAttempt(),
    { identity } = useAuth()
  return (
    <div className="course-workspace">
      <h1>Quiz attempt</h1>
      <LoadState {...result} retry={result.reload} />
      {result.data && (
        <WorkspaceAccessContext.Provider
          value={result.error ? { error: result.error, retry: result.reload } : undefined}
        >
          <div className={result.error ? 'offering-content permission-lost' : 'offering-content'}>
            <AttemptWorkspace
              key={`${identity!.me.account.id}:${result.data.attempt.id}`}
              initial={result.data}
              live={result.data}
              reload={result.reload}
            />
          </div>
        </WorkspaceAccessContext.Provider>
      )}
    </div>
  )
}
function AttemptWorkspace({
  initial,
  live,
  reload,
}: {
  initial: AttemptView
  live: AttemptView
  reload(): void
}) {
  const { identity } = useAuth(),
    [queue] = useState(() => new AnswerQueue(services.quiz, initial, identity!.me.account.id)),
    state = useSyncExternalStore(queue.subscribe, queue.getSnapshot),
    [index, setIndex] = useState(0),
    [review, setReview] = useState(false),
    [seal, setSeal] = useState(false),
    action = useAction(),
    seconds = useCountdown(live.attempt.endAt, live.serverNow),
    view = state.view.attempt.version > live.attempt.version ? state.view : live,
    q = view.attempt.questions[index],
    durable = state.view.attempt.answers,
    choice = q ? (state.local[String(q.id)] ?? durable[String(q.id)] ?? '') : '',
    active = view.attempt.status === 'IN_PROGRESS' && seconds > 0,
    canEdit = active && view.canAnswer && !view.teacher && !state.paused && !state.sealing,
    otherTab =
      live.attempt.version > state.expectedVersion &&
      state.pending === 0 &&
      live.attempt.status === 'IN_PROGRESS'
  const rows = view.attempt.questions.map((q) => ({
    q,
    saved: durable[String(q.id)] ?? '',
    local: state.local[String(q.id)] ?? '',
  }))
  return (
    <>
      <div className="breadcrumb">
        <Link to={`/quizzes/${view.attempt.quizId}`}>{view.quizTitle}</Link> / Attempt{' '}
        {view.attempt.id}
      </div>
      <Panel title={view.quizTitle} icon="book-small">
        <div className={`quiz-timer ${active ? 'is-active' : ''}`} role="timer" aria-live="off">
          <Icon name="quizzes" size={22} />
          {active
            ? `In progress · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} remaining`
            : 'Sealed / time ended · Only saved answers are finalized'}
        </div>
        <details className="attempt-timing">
          <summary>Attempt details</summary>
          <p>One attempt · {view.student.displayName}</p>
          <p>
            Started: {formatInstant(view.attempt.startedAt)}
            <br />
            Closes: {formatInstant(view.closeAt)} · Duration: {view.durationMinutes} minutes
            <br />
            Ends: {formatInstant(view.attempt.endAt)}
          </p>
        </details>
      </Panel>
      {q && (
        <Panel title={`Question ${index + 1} of ${view.attempt.questions.length}`} icon="info">
          <p className="material-body">{q.prompt}</p>
          <fieldset className="quiz-answer-options" disabled={!canEdit || otherTab}>
            <legend>Select one answer</legend>
            {Object.entries(q.options).map(([key, text]) => (
              <label key={key}>
                <input
                  type="radio"
                  name={`attempt-question-${q.id}`}
                  value={key}
                  checked={choice === key}
                  onChange={() => queue.edit(q.id, key)}
                />
                <span>
                  {key} · {text}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="actions quiz-question-controls">
            <NavigationButton
              direction="previous"
              label="Previous question"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            />
            {!view.teacher && (
              <Button
                icon="save-dark"
                tone="secondary"
                disabled={!canEdit || otherTab || !choice}
                onClick={() => queue.enqueue(q.id)}
              >
                Save answer
              </Button>
            )}
            <NavigationButton
              direction="next"
              label="Next question"
              disabled={index >= view.attempt.questions.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            />
          </div>
          <p>
            {state.local[String(q.id)]
              ? 'Unsaved answer'
              : durable[String(q.id)]
                ? state.view.savedAt[String(q.id)]
                  ? `Saved · ${formatInstant(state.view.savedAt[String(q.id)])}`
                  : 'Saved'
                : 'Unanswered'}
          </p>
        </Panel>
      )}
      <Panel title="Answer status" icon="info">
        <Feedback action={action} />
        {state.error && (
          <Status error>{state.error.message} Local choices are kept. Do not retry blindly.</Status>
        )}
        {otherTab && (
          <Status error>
            Another tab changed the saved attempt. Review saved answers before continuing.
          </Status>
        )}
        <p>
          {state.pending} queued/saving · {Object.keys(durable).length} saved answers ·{' '}
          {view.attempt.questions.length - Object.keys(durable).length} unanswered
        </p>
        <p>Only saved answers will be submitted. Refreshing does not extend the time limit.</p>
        <div className="actions">
          <Button icon="preview" tone="secondary" onClick={() => setReview(true)}>
            Review answers
          </Button>
          <Button
            icon="refresh"
            tone="secondary"
            disabled={!!state.pending || state.sealing || action.pending}
            onClick={() =>
              void action.run(
                () => queue.check(),
                () => setReview(true),
              )
            }
          >
            Check saved answers
          </Button>
          {!view.teacher && active && (
            <Button
              icon="quiz-submit"
              disabled={state.sealing || state.paused || otherTab}
              onClick={() => setSeal(true)}
            >
              Submit early
            </Button>
          )}
          <Button icon="refresh" tone="secondary" onClick={reload}>
            Refresh
          </Button>
        </div>
      </Panel>
      {view.attempt.status === 'SEALED' && <AttemptResult view={view} />}{' '}
      {review && (
        <Dialog wide title="Review saved and local answers" close={() => setReview(false)}>
          <Feedback action={action} />
          <DataTable
            rows={rows}
            rowKey={(r) => r.q.id}
            columns={[
              { label: 'Question', render: (r) => `${r.q.ordinal}. ${r.q.prompt}` },
              { label: 'Previously confirmed saved', render: (r) => r.saved || 'Unanswered' },
              { label: 'Local choice', render: (r) => r.local || 'No pending change' },
              {
                label: 'Latest service answer',
                render: (r) =>
                  state.reviewed
                    ? (state.reviewed.attempt.answers[String(r.q.id)] ?? 'Unanswered')
                    : 'Check saved answers to compare',
              },
            ]}
          />
          {state.reviewed && (
            <Status>
              Latest service version: {state.reviewed.attempt.version}. Review the differences
              before adopting this version. Keeping local choices does not save them automatically.
            </Status>
          )}
          <div className="actions">
            <Button
              icon="refresh"
              tone="secondary"
              disabled={!!state.pending || state.sealing || action.pending}
              onClick={() => void action.run(() => queue.check())}
            >
              Check saved answers
            </Button>
            {state.reviewed && (
              <>
                <Button
                  tone="secondary"
                  disabled={state.sealing}
                  onClick={() => {
                    queue.adopt(false)
                    setReview(false)
                    reload()
                  }}
                >
                  Use saved answers
                </Button>
                <Button
                  disabled={state.sealing}
                  onClick={() => {
                    queue.adopt(true)
                    setReview(false)
                    reload()
                  }}
                >
                  Keep my changes
                </Button>
              </>
            )}
            <Button icon="cancel-dark" tone="secondary" onClick={() => setReview(false)}>
              Close review
            </Button>
          </div>
        </Dialog>
      )}
      {seal && (
        <Dialog title="Finalize attempt?" icon="info" close={() => setSeal(false)}>
          <Feedback action={action} />
          <p>
            {view.attempt.questions.length - Object.keys(durable).length} questions are currently
            unanswered in the service. {state.pending} saves are queued. This action waits for
            queued saves, then seals only durable saved answers. Unsaved local choices are excluded.
            Answers cannot change after seal.
          </p>
          <div className="actions">
            <Button
              icon="cancel-dark"
              tone="secondary"
              disabled={state.sealing}
              onClick={() => setSeal(false)}
            >
              Cancel
            </Button>
            <Button
              icon="complete-white"
              disabled={state.sealing || action.pending}
              onClick={() =>
                void action.run(
                  () => queue.seal(),
                  () => {
                    setSeal(false)
                    reload()
                  },
                )
              }
            >
              {state.sealing ? 'Waiting for pending saves…' : 'Finalize attempt'}
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
