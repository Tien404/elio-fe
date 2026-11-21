import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button, Dialog, Field } from '@/components/ui'
import { Feedback, Select, TextArea } from '@/components/workspace/WorkspaceUI'
import { services } from '@/services'
import type { CreateCatalogCourseInput } from '@/services/course-contracts'
import { useAction } from '@/services/use-action'

export function CatalogSubjectDialog({ close }: { close(): void }) {
  const [facultyCode, setFacultyCode] = useState('')
  const [yearLevel, setYearLevel] = useState('1')
  const [degreeLevel, setDegreeLevel] =
    useState<CreateCatalogCourseInput['degreeLevel']>('UNDERGRADUATE')
  const [courseName, setCourseName] = useState('')
  const [credits, setCredits] = useState('')
  const [description, setDescription] = useState('')
  const action = useAction()
  const navigate = useNavigate()

  return (
    <Dialog title="Create catalog subject" icon="book-small" close={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void action.run(
            () =>
              services.courses.createCatalog({
                facultyCode: facultyCode.trim(),
                yearLevel: Number(yearLevel),
                degreeLevel,
                courseName: courseName.trim(),
                credits: Number(credits),
                description: description.trim() || undefined,
              }),
            (course) => navigate(`/courses/${course.id}`),
          )
        }}
      >
        <Feedback action={action} />
        <Field
          label="Subject name"
          required
          maxLength={200}
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
        />
        <Field
          label="Faculty code"
          required
          pattern="[A-Za-z]{2,4}"
          maxLength={4}
          placeholder="CS"
          value={facultyCode}
          onChange={(e) => setFacultyCode(e.target.value)}
        />
        <Field
          label="Year level"
          type="number"
          required
          min={1}
          max={9}
          step={1}
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
        />
        <Select
          label="Degree level"
          value={degreeLevel}
          onChange={(e) => setDegreeLevel(e.target.value as typeof degreeLevel)}
        >
          <option value="UNDERGRADUATE">Undergraduate</option>
          <option value="MASTERS">Master's</option>
          <option value="PHD">PhD</option>
        </Select>
        <Field
          label="Credits"
          type="number"
          required
          min={0.1}
          max={99.9}
          step={0.1}
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
        />
        <TextArea
          label="Description (optional)"
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="actions">
          <Button tone="secondary" onClick={close} disabled={action.pending}>
            Cancel
          </Button>
          <Button type="submit" disabled={action.pending}>
            {action.pending ? 'Creating…' : 'Create subject'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
