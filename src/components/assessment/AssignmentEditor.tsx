import { ActionButton as Button } from '@/components/workspace/WorkspaceUI'
import { useCallback, useState } from 'react'
import { Dialog, Field, Status } from '@/components/ui'
import { Feedback, Select, TextArea } from '@/components/workspace/WorkspaceUI'
import { FileUploader } from './Files'
import { vietnamInput, utcInput } from '@/services/assessment-time'
import { services } from '@/services'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'
import type { AssignmentInput, AssignmentView } from '@/services/assessment-contracts'
import type { FileAsset } from '@/services/contracts'
export function AssignmentEditor({
  offeringId,
  view,
  close,
  saved,
}: {
  offeringId: number
  view?: AssignmentView
  close(): void
  saved(id: number): void
}) {
  const [snapshot, setSnapshot] = useState(view),
    [preview, setPreview] = useState(false),
    action = useAction()
  const base = () => {
    const a = snapshot?.assignment,
      start = new Date().toISOString()
    return {
      title: a?.title ?? '',
      instructions: a?.instructions ?? '',
      mode: a?.mode ?? 'INDIVIDUAL',
      maxGroupSize: a?.maxGroupSize ?? 4,
      groupFormation: a?.groupFormation ?? 'SELF',
      status: a?.status ?? 'DRAFT',
      openAt: a?.openAt ?? start,
      dueAt: a?.dueAt ?? start,
      cutoffAt: a?.cutoffAt ?? start,
      maxScore: a?.maxScore ?? 10,
      weight: a?.weight ?? 0,
      topicId: snapshot?.topicId ?? null,
      fileIds: snapshot?.attachments.map((f) => f.id) ?? [],
      mandatory: snapshot?.mandatory ?? true,
    } satisfies AssignmentInput
  }
  const [input, setInput] = useState<AssignmentInput>(base),
    [files, setFiles] = useState<FileAsset[]>(snapshot?.attachments ?? [])
  const load = useCallback(
      () => services.content.topics(offeringId, { pageSize: 100 }),
      [offeringId],
    ),
    topics = useResource(load, `assignment-topics:${offeringId}`),
    published = snapshot && snapshot.assignment.status !== 'DRAFT'
  function update<K extends keyof AssignmentInput>(key: K, value: AssignmentInput[K]) {
    setInput((v) => ({ ...v, [key]: value }))
  }
  async function save(status: AssignmentInput['status']) {
    return services.assessment.save(
      offeringId,
      snapshot?.assignment.id ?? null,
      { ...input, status, fileIds: files.map((f) => f.id) },
      snapshot?.assignment.version,
    )
  }
  return (
    <Dialog
      wide
      title={published ? 'Extend assignment deadlines' : 'Assignment editor'}
      close={close}
    >
      <Feedback
        action={action}
        review={
          snapshot
            ? () =>
                void action.run(
                  () => services.assessment.get(snapshot.assignment.id),
                  (fresh) => {
                    setSnapshot(fresh)
                    setInput({
                      ...fresh.assignment,
                      topicId: fresh.topicId,
                      fileIds: fresh.attachments.map((f) => f.id),
                      mandatory: fresh.mandatory,
                    })
                    setFiles(fresh.attachments)
                  },
                )
            : undefined
        }
      />
      {preview ? (
        <>
          <h3>{input.title || 'Untitled assignment'}</h3>
          <p className="material-body">{input.instructions}</p>
          <p>
            {input.mode} · {input.maxScore} points · {input.weight}%
          </p>
          <Button tone="secondary" onClick={() => setPreview(false)}>
            Back to editor
          </Button>
        </>
      ) : (
        <>
          <fieldset disabled={action.pending || !!published}>
            <Field
              label="Title"
              maxLength={200}
              value={input.title}
              onChange={(e) => update('title', e.target.value)}
            />
            <TextArea
              label="Instructions"
              maxLength={50000}
              value={input.instructions ?? ''}
              onChange={(e) => update('instructions', e.target.value)}
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
            {topics.error && <Status error>{topics.error.message}</Status>}
            {input.mode === 'GROUP' && (
              <>
                <Field
                  label="Maximum group size"
                  type="number"
                  min={1}
                  max={20}
                  value={input.maxGroupSize ?? 4}
                  onChange={(e) => update('maxGroupSize', Number(e.target.value))}
                />
                <Select
                  label="Group formation"
                  value={input.groupFormation ?? 'SELF'}
                  onChange={(e) =>
                    update('groupFormation', e.target.value as 'SELF' | 'INSTRUCTOR')
                  }
                >
                  <option value="SELF">Students choose their groups</option>
                  <option value="INSTRUCTOR">Instructor assigns groups</option>
                </Select>
              </>
            )}
            <div className="form-grid">
              <Field
                label="Maximum score"
                type="number"
                min="0.01"
                step="0.01"
                value={input.maxScore}
                onChange={(e) => update('maxScore', Number(e.target.value))}
              />
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
                label="Assignment mode"
                value={input.mode}
                onChange={(e) => update('mode', e.target.value as AssignmentInput['mode'])}
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Group</option>
              </Select>
              <Select
                label="Requirement"
                value={String(input.mandatory)}
                onChange={(e) => update('mandatory', e.target.value === 'true')}
              >
                <option value="true">Required</option>
                <option value="false">Optional</option>
              </Select>
            </div>
            <FileUploader
              offeringId={offeringId}
              purpose="ASSIGNMENT_ATTACHMENT"
              files={files}
              change={setFiles}
            />
          </fieldset>
          <fieldset disabled={action.pending}>
            <div className="form-grid">
              {(['openAt', 'dueAt', 'cutoffAt'] as const).map((key, i) => (
                <Field
                  key={key}
                  label={['Open time', 'Submission deadline', 'Submission lock time'][i]}
                  type="datetime-local"
                  disabled={!!published && key === 'openAt'}
                  value={vietnamInput(input[key])}
                  onInput={(e) => {
                    if (e.currentTarget.value) update(key, utcInput(e.currentTarget.value))
                  }}
                />
              ))}
            </div>
          </fieldset>
          <div className="actions">
            <Button icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
              Cancel
            </Button>
            <Button icon="preview" tone="secondary" onClick={() => setPreview(true)}>
              Preview
            </Button>
            <Button
              tone="secondary"
              disabled={action.pending}
              onClick={() =>
                void action.run(
                  () => save(published ? 'PUBLISHED' : 'DRAFT'),
                  (v) => saved(v.assignment.id),
                )
              }
            >
              {published ? 'Save extension' : 'Save draft'}
            </Button>
            {!published && (
              <Button
                disabled={action.pending}
                onClick={() =>
                  void action.run(
                    () => save('PUBLISHED'),
                    (v) => saved(v.assignment.id),
                  )
                }
              >
                Publish assignment
              </Button>
            )}
          </div>
        </>
      )}
    </Dialog>
  )
}
