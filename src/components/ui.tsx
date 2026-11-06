import { DemoFaultControls } from '@/components/workspace/DemoFaultControls'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
import { LoadingBoundary } from '@/components/LoadingBoundary'
import {
  useEffect,
  useContext,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react'

export function Icon({
  name,
  size = 20,
  inheritColor = name !== 'mark' && name !== 'mark-white',
}: {
  name: string
  size?: number | string
  inheritColor?: boolean
}) {
  const source = `/assets/${name}.svg`
  return (
    <span
      aria-hidden="true"
      className={inheritColor ? 'icon icon-current' : 'icon'}
      style={{
        width: size,
        height: size,
        ...(inheritColor && {
          maskImage: `url("${source}")`,
          WebkitMaskImage: `url("${source}")`,
        }),
      }}
    >
      {!inheritColor && <img src={source} alt="" />}
    </span>
  )
}
export function Button({
  children,
  tone = 'primary',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  ref?: Ref<HTMLButtonElement>
  tone?: 'primary' | 'secondary'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`button ${tone}`}
      {...props}
      onClick={(event) => {
        event.currentTarget.focus()
        onClick?.(event)
      }}
    >
      {children}
    </button>
  )
}
export function NavigationButton({
  direction,
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  direction: 'previous' | 'next'
  label: string
}) {
  return (
    <Button
      {...props}
      tone="secondary"
      className="button secondary navigation-button"
      aria-label={label}
      title={label}
    >
      <Icon name={direction === 'previous' ? 'nav-previous' : 'nav-next'} size={20} />
    </Button>
  )
}
export function Field({
  label,
  error,
  id: providedId,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const generatedId = useId()
  const id = providedId ?? generatedId
  const search = /^(search|find)\b/i.test(label)
  const input = (
    <input
      id={id}
      type={search ? 'search' : undefined}
      placeholder={search ? `${label}…` : undefined}
      {...props}
      aria-invalid={!!error}
      aria-describedby={error ? `${id}-error` : undefined}
    />
  )
  return (
    <div className={`field${search ? ' field-search' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {search ? (
        <div className="field-input">
          <Icon name="search" size={20} inheritColor />
          {input}
        </div>
      ) : (
        input
      )}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  )
}
export function Status({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <div className={`status ${error ? 'error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
export function Panel({
  title,
  icon,
  children,
  actions,
}: {
  title: string
  icon: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className="panel">
      {actions ? (
        <div className="panel-heading">
          <h2>
            <Icon name={icon} size={20} inheritColor />
            {title}
          </h2>
          <div className="actions">{actions}</div>
        </div>
      ) : (
        <h2>
          <Icon name={icon} size={20} inheritColor />
          {title}
        </h2>
      )}
      {children}
    </section>
  )
}
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  )
}
export function EmptyState({
  title,
  description,
  icon = 'book-small',
}: {
  title: string
  description?: string
  icon?: string
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon">
        <Icon name={icon} size={24} inheritColor />
      </span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
    </div>
  )
}
export function Dialog({
  title,
  children,
  close,
  wide = false,
  icon,
}: {
  wide?: boolean
  icon?: string
  title: string
  children: ReactNode
  close(): void
}) {
  const accessError = useContext(WorkspaceAccessContext)
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current!
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={wide ? 'dialog-wide' : undefined}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>
          {icon && <Icon name={icon} size={20} inheritColor />}
          {title}
        </h2>
        <Button
          tone="secondary"
          className="button secondary dialog-close"
          onClick={close}
          aria-label="Close dialog"
          title="Close dialog"
        >
          <Icon name="close" size={20} inheritColor />
        </Button>
      </div>
      {accessError && (
        <Status error>
          {accessError.error.message} Your draft is kept. Saving is unavailable until current access
          is restored.
        </Status>
      )}
      <fieldset className="dialog-fields" disabled={!!accessError}>
        <LoadingBoundary>{children}</LoadingBoundary>
      </fieldset>
      <DemoFaultControls />
    </dialog>
  )
}
export function DataTable<T>({
  rows,
  columns,
  rowKey,
}: {
  rows: T[]
  columns: { label: string; render(row: T): ReactNode }[]
  rowKey(row: T): string | number
}) {
  return (
    <div
      className="table-scroll responsive-table-region"
      tabIndex={0}
      role="region"
      aria-label="Data table"
    >
      <table className="responsive-table" role="table">
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((c) => (
              <th key={c.label} scope="col" role="columnheader">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row) => (
            <tr key={rowKey(row)} role="row">
              {columns.map((c) => (
                <td key={c.label} role="cell">
                  <span className="table-cell-label" aria-hidden="true">
                    {c.label}
                  </span>
                  <div className="table-cell-content">{c.render(row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
