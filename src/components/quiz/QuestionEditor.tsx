import { useState } from 'react'
import { Dialog, Field, Status } from '@/components/ui'
import {
  ActionButton as Button,
  Feedback,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
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
        options: { A: '', B: '', C: '', D: '' },
        correctKey: 'A',
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
      value === 'TRUE_FALSE' ? { true: 'True', false: 'False' } : { A: '', B: '', C: '', D: '' }
    setInput((v) => ({
      ...v,
      kind: value,
      options,
      correctKey: value === 'TRUE_FALSE' ? 'true' : 'A',
    }))
  }
  function add() {
    const key = 'ABCDEFGHIJKLMNOPQRST'.split('').find((k) => !Object.hasOwn(input.options, k))
    if (key) field('options', { ...input.options, [key]: '' })
  }
  return (
    <Dialog
      wide
      title={input.kind === 'TRUE_FALSE' ? 'True-False question' : 'Question editor'}
      icon="info"
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
                label={`Choice ${key}`}
                value={value}
                onChange={(e) => field('options', { ...input.options, [key]: e.target.value })}
              />
              {input.kind === 'SINGLE_CHOICE' && Object.keys(input.options).length > 2 && (
                <Button
                  tone="secondary"
                  aria-label={`Remove choice ${key}`}
                  onClick={() => {
                    const next = { ...input.options }
                    delete next[key]
                    field('options', next)
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
        </div>
        {input.kind === 'SINGLE_CHOICE' && (
          <Button
            icon="add"
            tone="secondary"
            disabled={Object.keys(input.options).length >= 20}
            onClick={add}
          >
            Add option
          </Button>
        )}
        <Select
          label="Correct answer · exactly one"
          value={input.correctKey}
          onChange={(e) => field('correctKey', e.target.value)}
        >
          {!Object.hasOwn(input.options, input.correctKey) && (
            <option value="">Select a valid answer</option>
          )}
          {Object.keys(input.options).map((key) => (
            <option key={key} value={key}>
              {key}
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
          value={input.explanation ?? ''}
          onChange={(e) => field('explanation', e.target.value || null)}
        />
      </fieldset>
      <Status>Bank edits never change a published quiz copy.</Status>
      <div className="actions">
        <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </Button>
        <Button
          icon="quiz-save-white"
          disabled={action.pending}
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
