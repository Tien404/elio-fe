import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog, Field } from '@/components/ui'
import {
  ActionButton,
  Feedback,
  LoadState,
  Pager,
  Select,
  TextArea,
} from '@/components/workspace/WorkspaceUI'
import type { OfferingView } from '@/services/course-contracts'
import { services, apiMode } from '@/services'
import { useAction } from '@/services/use-action'
import { useResource } from '@/services/use-resource'

export function OfferingEditor({
  saved,
  close,
  courseId,
}: {
  saved?: OfferingView
  close(): void
  courseId?: number
}) {
  const action = useAction(),
    navigate = useNavigate()
  const [source, setSource] = useState(courseId ? String(courseId) : '')
  const [catalogPage, setCatalogPage] = useState(1),
    [search, setSearch] = useState('')
  const catalogLoad = useCallback(
    () => services.courses.catalog({ page: catalogPage, search }),
    [catalogPage, search],
  )
  const catalog = useResource(catalogLoad, `editor-catalog:${catalogPage}:${search}`)
  const pinnedLoad = useCallback(
    () => (courseId ? services.courses.catalogDetail(courseId) : Promise.resolve(null)),
    [courseId],
  )
  const pinned = useResource(pinnedLoad, `editor-catalog-selection:${courseId}`)
  const selectedSubject =
    catalog.data?.items.find((c) => c.id === Number(source)) ??
    (pinned.data?.id === Number(source) ? pinned.data : undefined)
  const [code, setCode] = useState(saved?.offering.courseCode ?? '')
  const [courseName, setCourseName] = useState(''),
    [credits, setCredits] = useState('3')
  const [title, setTitle] = useState(saved?.offering.title ?? '')
  const [semester, setSemester] = useState(saved?.offering.semester ?? '')
  const [sectionCode, setSectionCode] = useState(saved?.offering.sectionCode ?? '')
  const [info, setInfo] = useState(saved?.learningInformation ?? '')
  const [expected, setExpected] = useState(saved?.offering.version)
  async function reload() {
    if (!saved) return
    await action.run(
      () => services.courses.get(saved.offering.id),
      (value) => {
        setTitle(value.offering.title)
        setSemester(value.offering.semester)
        setSectionCode(value.offering.sectionCode)
        setInfo(value.learningInformation ?? '')
        setExpected(value.offering.version)
      },
    )
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    const found = selectedSubject
    void action.run(
      () =>
        saved
          ? services.courses.edit(
              saved.offering.id,
              { title, semester, sectionCode, learningInformation: info },
              expected!,
            )
          : services.courses.create({
              courseCode: found?.courseCode ?? code,
              courseName,
              credits: Number(credits),
              title,
              semester,
              sectionCode,
              learningInformation: info,
            }),
      (value) => {
        close()
        navigate(`/offerings/${value.offering.id}`)
      },
    )
  }
  return (
    <Dialog
      title={
        saved
          ? `Edit ${saved.offering.courseCode} · ${saved.offering.sectionCode}`
          : 'Create course section'
      }
      icon={saved ? 'edit' : 'book-small'}
      wide
      close={close}
    >
      <form onSubmit={submit}>
        <Feedback action={action} review={saved ? () => void reload() : undefined} />
        {!saved && (
          <>
            <p className="form-description">
              You will be the active lead instructor. New sections start as drafts.
            </p>
            <Field
              label="Search catalog"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCatalogPage(1)
                setSource('')
              }}
            />
            <LoadState loading={catalog.loading} error={catalog.error} retry={catalog.reload} />
            {source === String(courseId) && (
              <LoadState loading={pinned.loading} error={pinned.error} retry={pinned.reload} />
            )}
            <Select
              label="Catalog subject"
              value={source}
              required
              onChange={(e) => {
                const value = e.target.value,
                  found = catalog.data?.items.find((c) => c.id === Number(value))
                setSource(value)
                if (found) {
                  setCode(found.courseCode)
                  setTitle(found.courseName)
                }
              }}
            >
              <option value="">Select a catalog subject</option>
              {catalog.data?.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.courseCode} · {c.courseName}
                </option>
              ))}
              {pinned.data &&
                source === String(pinned.data.id) &&
                !catalog.data?.items.some((c) => c.id === pinned.data!.id) && (
                  <option value={pinned.data.id}>
                    {pinned.data.courseCode} · {pinned.data.courseName}
                  </option>
                )}
              {!apiMode && <option value="new">Create a new catalog subject</option>}
            </Select>
            {catalog.data && (
              <Pager
                value={catalog.data}
                change={(page) => {
                  setCatalogPage(page)
                  setSource('')
                }}
              />
            )}
            {source === 'new' && (
              <>
                <Field
                  label="Course code"
                  required
                  maxLength={40}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Field
                  label="Course name"
                  required
                  maxLength={200}
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
                <Field
                  label="Credits"
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                />
              </>
            )}
          </>
        )}
        <Field
          label="Name"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextArea
          label="Learning information"
          maxLength={10000}
          value={info}
          onChange={(e) => setInfo(e.target.value)}
        />
        <div className="field-grid">
          <Field
            label="Semester"
            required
            maxLength={40}
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
          <Field
            label="Section code"
            required
            maxLength={40}
            value={sectionCode}
            onChange={(e) => setSectionCode(e.target.value)}
          />
        </div>
        <div className="actions">
          <ActionButton
            icon="cancel-dark"
            tone="secondary"
            onClick={close}
            disabled={action.pending}
          >
            Cancel
          </ActionButton>
          <ActionButton
            icon={saved ? 'save' : 'add-white'}
            type="submit"
            disabled={
              action.pending ||
              (!saved && (!source || !!catalog.error || (source !== 'new' && !selectedSubject)))
            }
          >
            {action.pending ? 'Saving…' : saved ? 'Save changes' : 'Create course section'}
          </ActionButton>
        </div>
      </form>
    </Dialog>
  )
}
