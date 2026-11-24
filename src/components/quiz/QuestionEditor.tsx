import { useState } from 'react'
import { Dialog, Field } from '@/components/ui'
import {
  ActionButton as Button,
  Feedback,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { mustReview } from '@/services/errors'
import { useAction } from '@/services/use-action'
import { quizOptionLabel } from '@/services/quiz-status'
import type { QuestionInput, QuestionItem } from '@/services/quiz-contracts'
export function QuestionEditor({
  offeringId,
  question,
  close,
}: {
  offeringId: number
  question?: QuestionItem
  close(): void
}) {
  const [snapshot, setSnapshot] = useState(question),
    [input, setInput] = useState<QuestionInput>(
      question ?? {
        prompt: '',
        kind: 'SINGLE_CHOICE',
        options: { '1': '', '2': '', '3': '', '4': '' },
        correctKey: '1',
        points: 1,
        explanation: null,
      },
    ),
    action = useAction()
  function field<K extends keyof QuestionInput>(key: K, value: QuestionInput[K]) {
    setInput((v) => ({ ...v, [key]: value }))
  }
  function kind(value: QuestionInput['kind']) {
    const options: Record<string, string> =
      value === 'TRUE_FALSE'
        ? { '1': 'True', '2': 'False' }
        : { '1': '', '2': '', '3': '', '4': '' }
    setInput((v) => ({
      ...v,
      kind: value,
      options,
      correctKey: '1',
    }))
  }
  function add() {
    const key = Array.from({ length: 8 }, (_, i) => String(i + 1)).find(
      (k) => !Object.hasOwn(input.options, k),
    )
    if (key) field('options', { ...input.options, [key]: '' })
  }
  return (
    <Dialog
      wide
      title={input.kind === 'TRUE_FALSE' ? 'True-False question' : 'Question editor'}
      icon={question ? 'edit' : 'question-bank'}
      close={close}
    >
      <Feedback
        action={action}
        review={
          snapshot
            ? () =>
                void action.run(
                  () => services.quiz.question(snapshot.id),
                  (fresh) => {
                    setSnapshot(fresh)
                    setInput(fresh)
                  },
                )
            : undefined
        }
      />
      <fieldset disabled={action.pending}>
        <Select
          label="Question type"
          value={input.kind}
          onChange={(e) => kind(e.target.value as QuestionInput['kind'])}
        >
          <option value="SINGLE_CHOICE">Multiple choice · One correct</option>
          <option value="TRUE_FALSE">True / False</option>
        </Select>
        <TextArea
          label="Question content"
          maxLength={5000}
          value={input.prompt}
          onChange={(e) => field('prompt', e.target.value)}
        />
        <div className="quiz-options-editor">
          {Object.entries(input.options).map(([key, value]) => (
            <div key={key}>
              <Field
                label={`Choice ${quizOptionLabel(key)}`}
                maxLength={2000}
                value={value}
                onChange={(e) => field('options', { ...input.options, [key]: e.target.value })}
              />
              {input.kind === 'SINGLE_CHOICE' && Object.keys(input.options).length > 2 && (
                <Button
                  tone="secondary"
                  aria-label={`Remove choice ${quizOptionLabel(key)}`}
                  onClick={() => {
                    const next = { ...input.options }
                    delete next[key]
                    setInput((v) => ({
                      ...v,
                      options: next,
                      correctKey: key === v.correctKey ? '' : v.correctKey,
                    }))
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {input.kind === 'SINGLE_CHOICE' && (
          <div className="quiz-add-option">
            <Button
              icon="add"
              tone="secondary"
              disabled={Object.keys(input.options).length >= 20}
              onClick={add}
            >
              Add option
            </Button>
          </div>
        )}
        <Select
          label="Correct answer · exactly one"
          value={input.correctKey}
          onChange={(e) => field('correctKey', e.target.value)}
        >
          {!Object.hasOwn(input.options, input.correctKey) && (
            <option value="">Select a valid answer</option>
          )}
          {Object.entries(input.options).map(([key, text]) => (
            <option key={key} value={key}>
              {input.kind === 'TRUE_FALSE' && text
                ? `${quizOptionLabel(key)} · ${text}`
                : quizOptionLabel(key)}
            </option>
          ))}
        </Select>
        <Field
          label="Question score"
          type="number"
          min="0.01"
          step="0.01"
          value={input.points}
          onChange={(e) => field('points', Number(e.target.value))}
        />
        <TextArea
          label="Explanation (shown only after result release)"
          maxLength={10000}
          value={input.explanation ?? ''}
          onChange={(e) => field('explanation', e.target.value || null)}
        />
      </fieldset>
      {/* <Status>Bank edits never change a published quiz copy.</Status> */}
      <div className="actions">
        <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </Button>
        <Button
          icon="quiz-save-white"
          disabled={action.pending || mustReview(action.error)}
          onClick={() =>
            void action.run(
              () =>
                services.quiz.saveQuestion(
                  offeringId,
                  snapshot?.id ?? null,
                  input,
                  snapshot?.version,
                ),
              close,
            )
          }
        >
          Save question
        </Button>
      </div>
    </Dialog>
  )
}
