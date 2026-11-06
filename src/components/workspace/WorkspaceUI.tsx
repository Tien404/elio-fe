import {
  useContext,
  useEffect,
  useId,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Button, Dialog, Icon, NavigationButton, Status } from '@/components/ui'
import { SelectControl } from '@/components/SelectControl'
import { Spinner } from '@/components/LoadingBoundary'
import { LoadingContext } from '@/services/loading-context'
import { ServiceError } from '@/services/errors'
import type { Page } from '@/services/course-contracts'
import { useAction } from '@/services/use-action'

export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <div className={`field${/course|section/i.test(label) ? ' field-course' : ''}`}>
      <SelectControl
        label={label}
        icon={
          /course|section|topic/i.test(label)
            ? 'book-small'
            : /date|semester/i.test(label)
              ? 'calendar'
              : 'filter'
        }
        {...props}
      >
        {children}
      </SelectControl>
    </div>
  )
}
export function TextArea({
  label,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} {...props} />
    </div>
  )
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase()}`}>
      {value.replaceAll('_', ' ').toLowerCase()}
    </span>
  )
}
export function Pager({
  value,
  change,
  changeSize,
}: {
  value: Pick<Page<unknown>, 'page' | 'pageSize' | 'totalItems' | 'totalPages'>
  change(page: number): void
  changeSize?(size: number): void
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      {changeSize ? (
        <div className="pagination-size">
          <SelectControl
            label="Items per page"
            value={value.pageSize}
            onChange={(event) => changeSize(Number(event.target.value))}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </SelectControl>
        </div>
      ) : (
        <span>
          {value.totalItems} records · Page {value.totalPages ? value.page : 0} of{' '}
          {value.totalPages}
        </span>
      )}
      <div className="actions">
        <NavigationButton
          direction="previous"
          label="Previous page"
          disabled={value.page <= 1}
          onClick={() => change(value.page - 1)}
        />
        <NavigationButton
          direction="next"
          label="Next page"
          disabled={value.page >= value.totalPages}
          onClick={() => change(value.page + 1)}
        />
      </div>
    </nav>
  )
}
export function LoadState({
  loading,
  error,
  retry,
}: {
  loading: boolean
  error?: Error
  retry(): void
}) {
  const register = useContext(LoadingContext)
  const id = useId()
  useEffect(() => {
    if (loading && !error && register) return register(id)
  }, [loading, error, register, id])
  if (error)
    return (
      <Status error>
        {error.message}
        <div className="actions">
          <Button tone="secondary" onClick={retry}>
            Retry loading
          </Button>
        </div>
      </Status>
    )
  return loading && !register ? <Spinner /> : null
}
export function Feedback({
  action,
  review,
}: {
  action: Pick<ReturnType<typeof useAction>, 'error' | 'success'> & { pending?: boolean }
  review?: () => void
}) {
  return (
    <>
      <LoadState loading={!!action.pending} retry={() => undefined} />
      {action.error && (
        <Status error>
          {action.error.message}
          {review &&
            action.error instanceof ServiceError &&
            [409, 412].includes(action.error.status) && (
              <div className="actions">
                <Button tone="secondary" onClick={review}>
                  Discard input and reload saved values
                </Button>
              </div>
            )}
        </Status>
      )}
      {action.success && <Status>{action.success}</Status>}
    </>
  )
}
export function ActionButton({
  icon,
  children,
  danger = false,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: string; danger?: boolean }) {
  return (
    <Button
      {...props}
      className={`button ${danger ? 'danger' : props.tone === 'secondary' ? 'secondary' : 'primary'}`}
    >
      {icon && <Icon name={icon} size={20} inheritColor />}
      {children}
    </Button>
  )
}
export function ConfirmDialog({
  title,
  children,
  confirm,
  close,
  run,
  danger = false,
}: {
  title: string
  children: ReactNode
  confirm: string
  close(): void
  run(): Promise<unknown>
  danger?: boolean
}) {
  const action = useAction()
  return (
    <Dialog title={title} close={close}>
      <Feedback action={action} />
      <div className="confirmation-content">{children}</div>
      <div className="actions">
        <ActionButton icon="cancel-dark" tone="secondary" disabled={action.pending} onClick={close}>
          Cancel
        </ActionButton>
        <ActionButton
          danger={danger}
          disabled={action.pending}
          onClick={() => void action.run(run, close)}
        >
          {action.pending ? 'Please wait…' : confirm}
        </ActionButton>
      </div>
    </Dialog>
  )
}
