import { sumQuizPoints } from '@/services/quiz-points'
import { useCallback, useState } from 'react'
import { Dialog, Field, Status } from '@/components/ui'
import {
  ActionButton as Button,
  Select,
  Feedback,
  Pager,
  LoadState,
} from '@/components/workspace/WorkspaceUI'
import { QuizPreview } from './QuizPreview'
import { services } from '@/services'
import { mustReview } from '@/services/errors'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'
import { vietnamInput, utcInput } from '@/services/assessment-time'
import type { QuizInput, QuizView, QuestionItem, CopiedQuestion } from '@/services/quiz-contracts'
function fromView(v: QuizView): QuizInput {
  return {
    title: v.quiz.title,
    maxAttempts: v.maxAttempts ?? 1,
    gradingMethod: v.gradingMethod ?? 'HIGHEST_SCORE',
    releasePolicy: v.releasePolicy ?? 'AFTER_CLOSE',
    totalPoints: v.quiz.maxScore,
    openAt: v.quiz.openAt,
    closeAt: v.quiz.closeAt,
    durationMinutes: v.quiz.durationMinutes,
    weight: v.weight,
    topicId: v.topicId,
    mandatory: v.mandatory,
    questions: v.teacherContent?.selections.map((s) => ({ ...s })) ?? [],
  }
}
export function QuizEditor({
  offeringId,
  view,
  close,
  saved,
}: {
  offeringId: number
  view?: QuizView
  close(): void
  saved(id: number): void
}) {
  const [snapshot, setSnapshot] = useState(view),
    [input, setInput] = useState<QuizInput>(() =>
      view
        ? fromView(view)
        : {
            title: '',
            maxAttempts: 1,
            gradingMethod: 'HIGHEST_SCORE',
            releasePolicy: 'AFTER_CLOSE',
            openAt: new Date().toISOString(),
            closeAt: new Date(Date.now() + 3600000).toISOString(),
            durationMinutes: 20,
            weight: 0,
            topicId: null,
            mandatory: true,
            questions: [],
          },
    ),
    [distributionTotal, setDistributionTotal] = useState(10),
    [preview, setPreview] = useState(false),
    [page, setPage] = useState(1),
    [search, setSearch] = useState(''),
    [known, setKnown] = useState<QuestionItem[]>([]),
    action = useAction()
  const load = useCallback(
      () => services.quiz.bank(offeringId, { page, search }),
      [offeringId, page, search],
    ),
    bank = useResource(load, `quiz-editor-bank:${offeringId}:${page}:${search}`),
    topicsLoad = useCallback(
      () => services.content.topics(offeringId, { pageSize: 100 }),
      [offeringId],
    ),
    topics = useResource(topicsLoad, `quiz-topics:${offeringId}`),
    published = snapshot?.teacherContent?.published ?? false
  function update<K extends keyof QuizInput>(key: K, value: QuizInput[K]) {
    setInput((v) => ({ ...v, [key]: value }))
  }
  function toggle(q: QuestionItem, checked: boolean) {
    setKnown((old) => [...old.filter((x) => x.id !== q.id), q])
    update(
      'questions',
      checked
        ? [...input.questions, { questionItemId: q.id, points: q.points }]
        : input.questions.filter((s) => s.questionItemId !== q.id),
    )
  }
  function move(index: number, delta: number) {
    const next = [...input.questions],
      target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    update('questions', next)
  }
  const originals = new Map([...known, ...(bank.data?.items ?? [])].map((q) => [q.id, q])),
    copies: CopiedQuestion[] = published
      ? (snapshot?.teacherContent?.questions ?? [])
      : input.questions.flatMap((sel, index) => {
          const q = originals.get(sel.questionItemId),
            old = snapshot?.teacherContent?.questions.find(
              (q) => q.questionItemId === sel.questionItemId,
            )
          return q
            ? [
                {
                  ...q,
                  id: q.id,
                  ordinal: index + 1,
                  questionItemId: q.id,
                  sourceVersion: q.version,
                  points: sel.points,
                },
              ]
            : old
              ? [{ ...old, ordinal: index + 1, points: sel.points }]
              : []
        })
  async function save(publish: boolean) {
    const value = await services.quiz.save(
      offeringId,
      snapshot?.quiz.id ?? null,
      input,
      snapshot?.quiz.version,
      published,
    )
    if (publish) {
      setSnapshot(value)
      const done = await services.quiz.publish(value.quiz.id, value.quiz.version)
      return done
    }
    return value
  }
  return (
    <Dialog
      wide
      title={published ? 'Quiz schedule' : 'Quiz editor'}
      close={close}
      icon={view ? 'edit' : 'quizzes'}
    >
      <Feedback
        action={action}
        review={
          snapshot
            ? () =>
                void action.run(
                  () => services.quiz.get(snapshot.quiz.id),
                  (v) => {
                    setSnapshot(v)
                    setInput(fromView(v))
                  },
                )
            : undefined
        }
      />
      <Status>
        {snapshot?.scheduleLocked
          ? 'Schedule and duration are locked from the first attempt.'
          : 'Duration must fit within the availability window.'}{' '}
        Questions cannot change after publication.
      </Status>
      <fieldset disabled={published || action.pending}>
        <Field
          label="Title"
          maxLength={200}
          value={input.title}
          onChange={(e) => update('title', e.target.value)}
        />
        <Select
          label="Topic (optional)"
          value={input.topicId ?? ''}
          onChange={(e) => update('topicId', Number(e.target.value) || null)}
        >
          <option value="">No topic</option>
          {topics.data?.items.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </Select>
        <LoadState {...topics} retry={topics.reload} />
        <div className="form-grid">
          <Field
            label="Maximum attempts (0 = unlimited)"
            type="number"
            min={0}
            max={100}
            value={input.maxAttempts ?? 1}
            onChange={(e) => update('maxAttempts', Number(e.target.value))}
            disabled={!!published}
          />
          <Select
            label="Counted score"
            value={input.gradingMethod ?? 'HIGHEST_SCORE'}
            onChange={(e) => update('gradingMethod', e.target.value as QuizInput['gradingMethod'])}
            disabled={!!published}
          >
            <option value="HIGHEST_SCORE">Highest score</option>
            <option value="LATEST_ATTEMPT">Latest attempt</option>
            <option value="AVERAGE">Average</option>
          </Select>
          <Select
            label="Release results"
            value={input.releasePolicy ?? 'AFTER_CLOSE'}
            onChange={(e) => update('releasePolicy', e.target.value as QuizInput['releasePolicy'])}
            disabled={!!published}
          >
            <option value="AFTER_CLOSE">After quiz closes</option>
            <option value="IMMEDIATE">After each attempt (answers after close)</option>
          </Select>
          <Field
            label="Weight (%)"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={input.weight}
            onChange={(e) => update('weight', Number(e.target.value))}
          />
          <Select
            label="Requirement"
            value={String(input.mandatory)}
            onChange={(e) => update('mandatory', e.target.value === 'true')}
          >
            <option value="true">Required</option>
            <option value="false">Optional</option>
          </Select>
        </div>
      </fieldset>
      <fieldset disabled={action.pending || !!snapshot?.scheduleLocked}>
        <div className="form-grid">
          {(['openAt', 'closeAt'] as const).map((key, index) => (
            <Field
              key={key}
              type="datetime-local"
              label={index ? 'Close time' : 'Open time'}
              value={vietnamInput(input[key])}
              onInput={(e) => {
                if (e.currentTarget.value) update(key, utcInput(e.currentTarget.value))
              }}
            />
          ))}
          <Field
            label="Duration (minutes)"
            type="number"
            min={1}
            step={1}
            value={input.durationMinutes}
            onChange={(e) => update('durationMinutes', Number(e.target.value))}
          />
          {!published && (
            <div className="form-grid">
              <Field
                label="Total to distribute across questions"
                type="number"
                min={0.01}
                step={0.01}
                value={distributionTotal}
                onChange={(e) => setDistributionTotal(Number(e.target.value))}
              />
              <Button
                tone="secondary"
                disabled={
                  !input.questions.length ||
                  !Number.isFinite(distributionTotal) ||
                  Math.round(distributionTotal * 100) < input.questions.length
                }
                onClick={() => {
                  const cents = Math.round(distributionTotal * 100),
                    base = Math.floor(cents / input.questions.length)
                  update(
                    'questions',
                    input.questions.map((q, i) => ({
                      ...q,
                      points: (base + (i < cents % input.questions.length ? 1 : 0)) / 100,
                    })),
                  )
                }}
              >
                Distribute points equally
              </Button>
            </div>
          )}
          <Field
            label="Maximum score · sum of question points"
            readOnly
            value={sumQuizPoints(input.questions.map((q) => q.points))}
          />
        </div>
      </fieldset>
      <fieldset className="quiz-question-picker" disabled={action.pending || published}>
        <legend>Question selection and order</legend>
        <Field
          label="Search bank"
          maxLength={200}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <LoadState {...bank} retry={bank.reload} />
        {bank.data?.items.map((q) => (
          <label className="quiz-bank-choice" key={q.id}>
            <input
              type="checkbox"
              checked={input.questions.some((s) => s.questionItemId === q.id)}
              onChange={(e) => toggle(q, e.target.checked)}
            />
            <span>
              {q.prompt}
              <small>
                {q.kind === 'TRUE_FALSE' ? 'True / False' : 'Multiple choice'} · Bank score{' '}
                {q.points}
              </small>
            </span>
          </label>
        ))}
        {bank.data && <Pager value={bank.data} change={setPage} />}
        <ol className="quiz-selected">
          {input.questions.map((sel, index) => (
            <li key={sel.questionItemId}>
              <p>
                {originals.get(sel.questionItemId)?.prompt ??
                  snapshot?.teacherContent?.questions.find(
                    (q) => q.questionItemId === sel.questionItemId,
                  )?.prompt ??
                  `Question ${sel.questionItemId}`}
              </p>
              <Field
                label={`Points for question ${index + 1}`}
                type="number"
                min="0.01"
                step="0.01"
                value={sel.points}
                onChange={(e) =>
                  update(
                    'questions',
                    input.questions.map((s) =>
                      s.questionItemId === sel.questionItemId
                        ? { ...s, points: Number(e.target.value) }
                        : s,
                    ),
                  )
                }
              />
              <div className="actions">
                <Button
                  icon="move-up"
                  tone="secondary"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  Move up
                </Button>
                <Button
                  icon="move-down-white"
                  disabled={index === input.questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  Move down
                </Button>
                <Button
                  icon="trash-white"
                  danger
                  onClick={() =>
                    update(
                      'questions',
                      input.questions.filter((s) => s.questionItemId !== sel.questionItemId),
                    )
                  }
                >
                  Remove question
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </fieldset>
      <div className="actions">
        <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </Button>
        <Button
          icon="preview"
          tone="secondary"
          disabled={copies.length !== input.questions.length || !copies.length}
          onClick={() => setPreview(true)}
        >
          Preview
        </Button>
        <Button
          icon="save-dark"
          tone="secondary"
          disabled={action.pending || mustReview(action.error) || !!snapshot?.scheduleLocked}
          onClick={() =>
            void action.run(
              () => save(false),
              (v) => saved(v.quiz.id),
            )
          }
        >
          {published ? 'Save schedule' : 'Save draft'}
        </Button>
        {!published && (
          <Button
            icon="complete-white"
            disabled={action.pending || mustReview(action.error) || !input.questions.length}
            onClick={() =>
              void action.run(
                () => save(true),
                (v) => saved(v.quiz.id),
              )
            }
          >
            Publish quiz
          </Button>
        )}
      </div>
      {preview && (
        <QuizPreview title={input.title} questions={copies} close={() => setPreview(false)} />
      )}
    </Dialog>
  )
}
