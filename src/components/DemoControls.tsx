import { useState } from 'react'
import { demo, services } from '@/services'
import { presets, type Preset } from '@/mocks/scenarios'
import { DEMO_PASSWORD } from '@/mocks/seed'
import { Button, DataTable, Dialog, Field, Icon, Status } from '@/components/ui'
import type { Offering } from '@/services/contracts'
import { errorMessage } from '@/services/errors'

export function DemoControls() {
  const [quizMode, setQuizMode] = useState<'success' | 'pending' | 'error'>('success')
  const [courseScenarios, setCourseScenarios] = useState<{ id: number; title: string }[]>([])
  const [rows, setRows] = useState<Offering[] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [assetId, setAssetId] = useState('701')
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(false)
  const [message, setMessage] = useState('')
  const [preset, setPreset] = useState<Preset>('normal')
  const [latency, setLatency] = useState('350')
  if (!demo) return null
  function action(fn: () => void | string) {
    try {
      const message = fn()
      setMessage(message || 'Demo control applied.')
    } catch (e) {
      setMessage(errorMessage(e))
    }
  }
  async function loadSections() {
    setBusy(true)
    try {
      setRows(await services.workspace.listOfferings())
      setMessage('Accessible sections loaded from the shared store.')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function stageFile() {
    if (!file) {
      setMessage('Select a demo file first.')
      return
    }
    setBusy(true)
    try {
      const asset = await services.files.stage(file, 101, 'SUBMISSION')
      setAssetId(String(asset.id))
      setMessage(`Asset ${asset.id} staged only. This is not a confirmed submission.`)
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function download() {
    setBusy(true)
    try {
      const blob = await services.files.download(Number(assetId))
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `elio-demo-asset-${assetId}`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Demo download prepared.')
    } catch (e) {
      setMessage(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <details className="demo-controls">
        <summary title="Demo tools">
          <span className="demo-tools-icon">
            <Icon name="settings" size={20} />
          </span>
          <span className="demo-tools-label">Demo tools · Mock simulation</span>
        </summary>
        <div>
          <p>Use fake credentials only. Demo session, files and finalization simulate UX.</p>
          <p>
            Emails: student, student2, lead, co, admin, outsider, locked, temporary{' '}
            <strong>@demo.elio.test</strong>
            <br />
            Initial password: <code>{DEMO_PASSWORD}</code>
          </p>
          <p>
            Changed demo passwords survive reload as demo-only verifiers. Reset restores initial
            accounts.
          </p>
          <Button tone="secondary" onClick={() => action(() => demo!.prepareInboxScenarios())}>
            Add inbox review fixtures
          </Button>
          <label htmlFor="scenario">Next service request</label>
          <select
            id="scenario"
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
          >
            {presets.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Button
            tone="secondary"
            onClick={() => {
              demo!.scenarios.set(preset)
              setMessage(`Armed ${preset} for one request. Empty applies to list operations.`)
            }}
          >
            Arm scenario
          </Button>
          <label htmlFor="latency">Latency (milliseconds)</label>
          <input
            id="latency"
            type="number"
            min={0}
            max={10000}
            value={latency}
            onChange={(e) => setLatency(e.target.value)}
          />
          <Button
            tone="secondary"
            onClick={() =>
              action(() =>
                demo!.scenarios.setLatency(Math.min(10000, Math.max(0, Number(latency) || 0))),
              )
            }
          >
            Apply latency
          </Button>
          <div className="actions">
            <Button tone="secondary" onClick={() => action(() => demo!.advanceClock(9))}>
              Advance clock 9h / expire session
            </Button>
            <Button tone="secondary" onClick={() => setReset(true)}>
              Reset demo…
            </Button>
          </div>
          <hr />
          <p>
            Quiz worker simulation uses only durable saved answers. These controls do not override
            scores or regrade successfully finalized attempts.
          </p>
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                const id = demo!.prepareQuizScenarios()
                return `Quiz Studio ready: /quizzes?offeringId=${id}. Publish its draft, then use student/student2. Duration 5 minutes, close +10 minutes from fixture creation.`
              })
            }
          >
            Add quiz review fixtures
          </Button>
          <label htmlFor="quiz-worker-mode">Mock quiz worker mode</label>
          <select
            id="quiz-worker-mode"
            value={quizMode}
            onChange={(e) => setQuizMode(e.target.value as typeof quizMode)}
          >
            <option value="success">Success</option>
            <option value="pending">Pending / held</option>
            <option value="error">Error / score unavailable</option>
          </select>
          <Button tone="secondary" onClick={() => action(() => demo!.setQuizWorkerMode(quizMode))}>
            Apply mock quiz worker mode
          </Button>
          <Button tone="secondary" onClick={() => action(() => demo!.runQuizWorker())}>
            Run mock quiz worker
          </Button>
          <Button
            tone="secondary"
            onClick={() => action(() => demo!.retryFailedQuizFinalizations())}
          >
            Retry failed mock finalizations
          </Button>
          <Button tone="secondary" onClick={() => action(() => demo!.advanceClock(5 / 60))}>
            Advance demo clock 5 minutes
          </Button>
          <Button tone="secondary" onClick={() => action(() => demo!.advanceClock(15 / 60))}>
            Advance demo clock 15 minutes / past quiz close
          </Button>
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                demo!.loseQuizResponse('start')
                return 'Next successful quiz start will lose its response. Use Check existing attempt.'
              })
            }
          >
            Lose next quiz start response
          </Button>
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                demo!.loseQuizResponse('save')
                return 'Next successful quiz answer save will lose its response. Use Check saved answers.'
              })
            }
          >
            Lose next quiz save response
          </Button>
          <hr />
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                const id = demo!.prepareAssessmentScenarios()
                return `Assignment Studio ready: /assignments?offeringId=${id}. Students student/student2 share Design team with locked recipient Sam. Lead and co can grade. Clock: due +30min, cutoff +1h.`
              })
            }
          >
            Add assignment review fixtures
          </Button>
          <Button tone="secondary" onClick={() => action(() => demo!.advanceClock(2))}>
            Advance demo clock 2h / after cutoff
          </Button>
          <Button tone="secondary" onClick={() => action(() => demo!.loseNextConfirmResponse())}>
            Lose next confirm response
          </Button>
          <hr />
          <p>
            Workspace governance review fixtures are added explicitly and never replace existing
            classes. The extra active instructor uses instructor@demo.elio.test with the initial
            demo password.
          </p>
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                setCourseScenarios(demo!.prepareCourseScenarios())
              })
            }
          >
            Add workspace review fixtures
          </Button>
          {courseScenarios.map((item) => (
            <a key={item.id} href={`/offerings/${item.id}`}>
              {item.title} · Section {item.id}
            </a>
          ))}
          <Button
            tone="secondary"
            onClick={() =>
              action(() => {
                const count = demo!.finalizeExpiredDemoAttempts()
                return `${count} expired demo attempt guards marked finalized. This simulates worker completion only.`
              })
            }
          >
            Finalize expired demo attempt guards
          </Button>
          <hr />
          <p>
            Service foundation review. Use demo files only. Uploaded bytes stay in memory; select
            the file again after reload. Upload is not submission confirmation.
          </p>
          <Button tone="secondary" disabled={busy} onClick={() => void loadSections()}>
            Load accessible sections
          </Button>
          {rows &&
            (rows.length ? (
              <DataTable
                rows={rows}
                rowKey={(row) => row.id}
                columns={[
                  { label: 'Section', render: (row) => `${row.courseCode} · ${row.sectionCode}` },
                  { label: 'State', render: (row) => row.status },
                ]}
              />
            ) : (
              <Status>No accessible course sections.</Status>
            ))}
          <Field
            label="Demo file for course section 101"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button tone="secondary" disabled={busy} onClick={() => void stageFile()}>
            Stage demo file
          </Button>
          <Field
            label="File asset ID"
            type="number"
            min={1}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          />
          <Button tone="secondary" disabled={busy} onClick={() => void download()}>
            Download demo asset
          </Button>
          {message && <Status>{message}</Status>}
        </div>
      </details>
      {reset && (
        <Dialog title="Reset ELIO demo?" close={() => setReset(false)}>
          <p>
            This replaces only the ELIO demo store, including demo profiles, sessions, password
            verifiers and clock. Other browser data is preserved.
          </p>
          <div className="actions">
            <Button
              onClick={() => {
                action(() => demo!.reset())
                setReset(false)
              }}
            >
              Reset demo
            </Button>
            <Button tone="secondary" onClick={() => setReset(false)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
