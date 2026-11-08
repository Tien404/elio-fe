import { Link } from 'react-router'
import { Panel, Status, DataTable } from '@/components/ui'
import type { AttemptView } from '@/services/quiz-contracts'
import { formatInstant } from '@/services/presentation'
export function AttemptResult({ view }: { view: AttemptView }) {
  const r = view.result
  return (
    <Panel title="Quiz result" icon="publish-small">
      {r.state === 'PUBLISHED' ? (
        <>
          <p className="overall-result">
            {r.score} / {r.maxScore} · Published
          </p>
          <p>Released {formatInstant(r.releasedAt)}.</p>
          <DataTable
            rows={r.breakdown}
            rowKey={(b) => b.questionId}
            columns={[
              {
                label: 'Question',
                render: (b) =>
                  view.attempt.questions.find((q) => q.id === b.questionId)?.prompt ?? b.questionId,
              },
              {
                label: 'Your saved answer',
                render: (b) => view.attempt.answers[String(b.questionId)] ?? 'Unanswered',
              },
              { label: 'Correct answer', render: (b) => b.correctKey },
              { label: 'Points', render: (b) => b.awardedPoints },
              { label: 'Explanation', render: (b) => b.explanation ?? 'No explanation.' },
            ]}
          />
        </>
      ) : (
        <Status>
          {view.finalization === 'ERROR'
            ? 'Grading failed. Your score is unavailable; this does not count as zero.'
            : r.state === 'WAITING_FOR_RESTORE'
              ? 'Finalized · Waiting for course-section restore before release.'
              : r.state === 'WAITING_FOR_CLOSE'
                ? 'Waiting for quiz close. Scores and answer keys remain unavailable until eligible release.'
                : 'Finalization pending · Result processing. Only durable saved answers are used.'}
        </Status>
      )}
      <Link className="button secondary" to={`/results?offeringId=${view.offeringId}`}>
        {view.teacher ? 'Open gradebook' : 'My published results'}
      </Link>
    </Panel>
  )
}
