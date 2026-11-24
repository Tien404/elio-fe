import { useOfferingRoute } from '@/services/use-offering-route'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import { Panel, Dialog, Status, DataTable, NavigationButton, Icon } from '@/components/ui'
import { ActionButton as Button, Feedback, LoadState } from '@/components/workspace/WorkspaceUI'
import { AttemptResult } from '@/components/quiz/AttemptResult'
import { apiMode, services } from '@/services'
import { useAttempt } from '@/services/use-quiz'
import { AnswerQueue } from '@/services/answer-queue'
import { useAction } from '@/services/use-action'
import { useAuth } from '@/services/auth-context'
import { requiresSessionRefresh, ServiceError } from '@/services/errors'
import { useCountdown } from '@/services/use-countdown'
import { formatInstant } from '@/services/presentation'
import { quizOptionLabel } from '@/services/quiz-status'
import type { AttemptView } from '@/services/quiz-contracts'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
export function QuizAttempt() {
  const result = useAttempt(),
    { identity } = useAuth()
  const accessLost =
    result.error instanceof ServiceError && [401, 403, 404].includes(result.error.status)
  return (
    <div className="course-workspace quiz-attempt-page">
      <LoadState
        loading={result.loading && !result.data}
        error={result.error}
        retry={result.reload}
      />
      {result.data && !accessLost && (
        <WorkspaceAccessContext.Provider
          value={result.error ? { error: result.error, retry: result.reload } : undefined}
        >
          <div className={result.error ? 'offering-content permission-lost' : 'offering-content'}>
            <AttemptWorkspace
              key={`${identity!.me.account.id}:${result.data.attempt.id}`}
              initial={result.data}
              live={result.data}
              reload={result.reload}
              accessPaused={!!result.error}
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
  accessPaused,
}: {
  initial: AttemptView
  live: AttemptView
  reload(): void
  accessPaused: boolean
}) {
  const { prefix } = useOfferingRoute()
  const { identity, refresh } = useAuth(),
    [queue] = useState(() => new AnswerQueue(services.quiz, initial, identity!.me.account.id)),
    state = useSyncExternalStore(queue.subscribe, queue.getSnapshot),
    [index, setIndex] = useState(0),
    [review, setReview] = useState(false),
    [seal, setSeal] = useState(false),
    action = useAction(),
    view =
      state.view.attempt.version > live.attempt.version ||
      (state.view.attempt.version === live.attempt.version &&
        Date.parse(state.view.serverNow) > Date.parse(live.serverNow))
        ? state.view
        : live,
    seconds = useCountdown(view.attempt.endAt, view.serverNow),
    q = view.attempt.questions[index],
    active = view.attempt.status === 'IN_PROGRESS' && seconds > 0,
    durable = active && !view.teacher ? state.view.attempt.answers : view.attempt.answers,
    choice = q ? ((active ? state.local[q.id] : undefined) ?? durable[q.id] ?? '') : '',
    canEdit =
      active && view.canAnswer && !accessPaused && !view.teacher && !state.paused && !state.sealing,
    otherTab =
      live.attempt.version > state.expectedVersion &&
      state.pending === 0 &&
      live.attempt.status === 'IN_PROGRESS'
  useEffect(() => {
    if (requiresSessionRefresh(state.error)) void refresh()
  }, [state.error, refresh])

  const totalQuestions = view.attempt.questions.length
  const answeredCount = Object.keys(durable).length
  const unansweredCount = totalQuestions - answeredCount
  const progressPercent =
    totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0
  const isUrgent = active && seconds > 0 && seconds <= 300

  const rows = view.attempt.questions.map((q) => ({
    q,
    saved: durable[String(q.id)] ?? '',
    local: state.local[String(q.id)] ?? '',
  }))

  return (
    <div className="quiz-attempt-workspace">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to={`${prefix}/quizzes/${view.attempt.quizId}`}>{view.quizTitle}</Link> / Attempt{' '}
        {view.attempt.attemptNo ?? view.attempt.id}
      </nav>
      <header className="quiz-attempt-page-header">
        <h1>{view.quizTitle}</h1>
        {active && (
          <div className="quiz-attempt-header-actions">
            <div
              className={`quiz-timer-card is-active ${isUrgent ? 'is-urgent' : ''}`}
              role="timer"
              aria-live="off"
            >
              <div className="quiz-timer-icon">
                <Icon name="quizzes" size={20} />
              </div>
              <div className="quiz-timer-content">
                <span className="quiz-timer-label">
                  {isUrgent ? 'Time running out' : 'Time remaining'}
                </span>
                <span className="quiz-timer-value">
                  {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </span>
              </div>
            </div>

            {!view.teacher && view.canAnswer && (
              <Button
                icon="complete-white"
                disabled={state.sealing || state.paused || otherTab || accessPaused}
                onClick={() => setSeal(true)}
              >
                Submit attempt
              </Button>
            )}
          </div>
        )}
      </header>
      {/* Sealed Results View */}
      {view.attempt.status === 'SEALED' && <AttemptResult view={view} />}
      {/* Active Exam Layout Grid */}
      <div className="quiz-attempt-grid">
        {/* Main: Active Question */}
        <div className="quiz-attempt-main">
          {q ? (
            <div className="quiz-question-box">
              <div className="quiz-question-card-header">
                <div className="quiz-question-badge">
                  Question {index + 1} <span>of {totalQuestions}</span>
                </div>
                <div className="quiz-question-save-status" role="status">
                  {active && state.saving[q.id] ? (
                    <span className="status-saving">
                      <span className="status-dot pulse" /> Saving…
                    </span>
                  ) : active && state.local[q.id] ? (
                    state.paused ? (
                      <span className="status-error">Save failed · Local kept</span>
                    ) : (
                      <span className="status-unsaved">Unsaved changes</span>
                    )
                  ) : durable[q.id] ? (
                    <span className="status-saved">
                      <Icon name="check" size={14} />
                      {(active && !view.teacher ? state.view.savedAt[q.id] : view.savedAt[q.id])
                        ? `Saved · ${formatInstant((active && !view.teacher ? state.view : view).savedAt[q.id])}`
                        : 'Saved'}
                    </span>
                  ) : (
                    <span className="status-unanswered">Unanswered</span>
                  )}
                </div>
              </div>

              <div className="quiz-question-prompt">{q.prompt}</div>

              <fieldset className="quiz-answer-options" disabled={!canEdit || otherTab}>
                <legend className="sr-only">Select one answer</legend>
                {Object.entries(q.options).map(([key, text]) => {
                  const isSelected = choice === key
                  return (
                    <label
                      key={key}
                      className={`quiz-option-card${isSelected ? ' is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`attempt-question-${q.id}`}
                        value={key}
                        checked={isSelected}
                        onChange={() => {
                          queue.edit(q.id, key)
                          if (apiMode) queue.enqueue(q.id)
                        }}
                      />
                      <span className="quiz-option-text">
                        {quizOptionLabel(key)}. {text}
                      </span>
                    </label>
                  )
                })}
              </fieldset>

              <div className="quiz-question-footer">
                <NavigationButton
                  direction="previous"
                  label="Previous question"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => i - 1)}
                />
                <div className="quiz-question-step-count">
                  {index + 1} of {totalQuestions}
                </div>
                <NavigationButton
                  direction="next"
                  label="Next question"
                  disabled={index >= totalQuestions - 1}
                  onClick={() => setIndex((i) => i + 1)}
                />
              </div>
            </div>
          ) : (
            <Panel title="No questions available" icon="info">
              <p>There are no questions in this quiz attempt.</p>
            </Panel>
          )}
        </div>

        {/* Sidebar: Question Navigator & Exam Info */}
        <aside className="quiz-attempt-sidebar">
          {/* Question Navigator Card */}
          <div className="quiz-sidebar-card">
            <div className="quiz-sidebar-header">
              <h2>Questions</h2>
              <span className="quiz-sidebar-count">
                {answeredCount}/{totalQuestions}
              </span>
            </div>

            <div className="quiz-progress-track" aria-hidden="true">
              <div className="quiz-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>

            <nav className="quiz-question-grid" aria-label="Question navigator">
              {view.attempt.questions.map((item, i) => {
                const answered = !!((active ? state.local[item.id] : undefined) ?? durable[item.id])
                const isCurrent = i === index
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`quiz-question-pill${isCurrent ? ' is-current' : ''}${answered ? ' is-answered' : ''}`}
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-label={`Question ${i + 1}${answered ? ', answered' : ', unanswered'}`}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}
                  </button>
                )
              })}
            </nav>

            <div className="quiz-navigator-legend">
              <span className="legend-item">
                <span className="legend-indicator current" /> Current
              </span>
              <span className="legend-item">
                <span className="legend-indicator answered" /> Answered
              </span>
              <span className="legend-item">
                <span className="legend-indicator unanswered" /> Unanswered
              </span>
            </div>
          </div>

          {/* Sync & Actions Card */}
          <div className="quiz-sidebar-card">
            <Feedback action={action} />
            {state.error && (
              <Status error>
                {state.error.message} Local choices are kept. Do not retry blindly.
              </Status>
            )}
            {otherTab && (
              <Status error>
                Another tab changed the saved attempt. Review saved answers before continuing.
              </Status>
            )}

            <div className="quiz-sync-status-box">
              <div className="quiz-sync-row">
                <span className="quiz-sync-label">Server sync</span>
                <span className="quiz-sync-val">
                  {state.pending > 0 ? `${state.pending} saving…` : 'All answers saved'}
                </span>
              </div>
              <div className="quiz-sync-row">
                <span className="quiz-sync-label">Unanswered</span>
                <span className="quiz-sync-val">{unansweredCount}</span>
              </div>
            </div>

            <div className="quiz-sidebar-actions">
              <Button icon="preview" tone="secondary" onClick={() => setReview(true)}>
                Review all answers
              </Button>
              <Button icon="refresh" tone="secondary" onClick={reload}>
                Refresh status
              </Button>
            </div>

            <details className="attempt-timing">
              <summary>Timing details</summary>
              <p>
                Started: {formatInstant(view.attempt.startedAt)}
                <br />
                Closes: {formatInstant(view.closeAt)}
                <br />
                Ends: {formatInstant(view.attempt.endAt)}
              </p>
            </details>
          </div>
        </aside>
      </div>{' '}
      {review && (
        <Dialog wide title="Review saved and local answers" close={() => setReview(false)}>
          <Feedback action={action} />
          <DataTable
            rows={rows}
            rowKey={(r) => r.q.id}
            columns={[
              {
                label: 'Question',
                render: (r) => (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      const idx = view.attempt.questions.findIndex((item) => item.id === r.q.id)
                      if (idx >= 0) setIndex(idx)
                      setReview(false)
                    }}
                  >
                    {r.q.ordinal}. {r.q.prompt}
                  </button>
                ),
              },
              {
                label: 'Previously confirmed saved',
                render: (r) => (r.saved ? quizOptionLabel(r.saved) : 'Unanswered'),
              },
              {
                label: 'Local choice',
                render: (r) => (r.local ? quizOptionLabel(r.local) : 'No pending change'),
              },
              {
                label: 'Latest service answer',
                render: (r) => {
                  if (!state.reviewed) return 'Check saved answers to compare'
                  const latest = state.reviewed.attempt.answers[String(r.q.id)]
                  return latest ? quizOptionLabel(latest) : 'Unanswered'
                },
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
                  disabled={state.sealing || !state.reviewed.canAnswer}
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
            unanswered.
            {/* {state.pending} saves are queued. This action waits for
            queued saves, then seals only durable saved answers. Unsaved local choices are excluded. */}
            Answers cannot change after finalized.
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
              disabled={
                state.sealing ||
                state.paused ||
                otherTab ||
                action.pending ||
                !active ||
                !view.canAnswer ||
                accessPaused
              }
              onClick={() =>
                void action.run(
                  () => queue.seal(),
                  () => {
                    setSeal(false)
                    reload()
                  },
                  'Quiz submitted.',
                )
              }
            >
              {state.sealing ? 'Waiting for pending saves…' : 'Finalize attempt'}
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
