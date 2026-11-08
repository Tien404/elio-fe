import { useState } from 'react'
import { Dialog, Panel, NavigationButton } from '@/components/ui'
import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import type { CopiedQuestion } from '@/services/quiz-contracts'
export function QuizPreview({
  title,
  questions,
  close,
}: {
  title: string
  questions: CopiedQuestion[]
  close(): void
}) {
  const [index, setIndex] = useState(0),
    q = questions[index]
  return (
    <Dialog wide title="Quiz preview" close={close}>
      <Panel title={`Preview · ${title}`} icon="book-small">
        {q ? (
          <>
            <p>
              Question {index + 1} of {questions.length} · {q.points} points
            </p>
            <p className="material-body">{q.prompt}</p>
            <fieldset className="quiz-answer-options">
              <legend>Answer choices · teacher preview</legend>
              {Object.entries(q.options).map(([key, text]) => (
                <label key={key}>
                  <input type="radio" name="quiz-preview" value={key} />
                  {key} · {text}
                </label>
              ))}
            </fieldset>
            <p>Teacher key: {q.correctKey}</p>
            <p className="material-body">{q.explanation || 'No explanation.'}</p>
          </>
        ) : (
          <p>Select at least one question to preview.</p>
        )}
        <div className="actions">
          <NavigationButton
            direction="previous"
            label="Previous"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          />
          <NavigationButton
            direction="next"
            label="Next"
            disabled={index >= questions.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          />
          <Button autoFocus icon="cancel-dark" tone="secondary" onClick={close}>
            Back to editor
          </Button>
        </div>
      </Panel>
    </Dialog>
  )
}
