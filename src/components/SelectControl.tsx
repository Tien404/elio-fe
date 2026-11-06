import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { Icon } from '@/components/ui'

type Option = { value: string; label: ReactNode; disabled?: boolean }

function readOptions(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((child) => {
    if (
      !isValidElement<{ value?: string | number; disabled?: boolean; children?: ReactNode }>(child)
    )
      return []
    if (child.type === 'option')
      return [
        {
          value: String(child.props.value ?? ''),
          label: child.props.children,
          disabled: child.props.disabled,
        },
      ]
    return readOptions(child.props.children)
  })
}

export function SelectControl({
  label,
  icon,
  children,
  id: suppliedId,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; icon?: string }) {
  const generatedId = useId(),
    id = suppliedId ?? generatedId
  const root = useRef<HTMLDivElement>(null),
    native = useRef<HTMLSelectElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    listbox = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    [invalid, setInvalid] = useState(false)
  const [localValue, setLocalValue] = useState(String(props.defaultValue ?? ''))
  const options = readOptions(children)
  const value = String(props.value ?? localValue)
  const selected = options.findIndex((option) => option.value === value)

  useLayoutEffect(() => {
    const list = listbox.current
    const button = trigger.current
    if (!open || !list || !button) return
    const position = () => {
      const rect = button.getBoundingClientRect()
      const viewport = window.visualViewport
      const viewportTop = viewport?.offsetTop ?? 0
      const viewportHeight = viewport?.height ?? window.innerHeight
      const viewportWidth = viewport?.width ?? window.innerWidth
      const width = Math.min(rect.width, viewportWidth - 16)
      const left = Math.max(8, Math.min(rect.left, viewportWidth - width - 8))
      Object.assign(list.style, {
        position: 'fixed',
        width: `${width}px`,
        left: `${left}px`,
        right: 'auto',
        bottom: 'auto',
        margin: '0',
      })
      const desiredHeight = Math.min(260, list.scrollHeight + 2)
      const below = viewportTop + viewportHeight - rect.bottom - 8
      const above = rect.top - viewportTop - 8
      const upwards = below < Math.min(desiredHeight, 160) && above > below
      const height = Math.max(44, Math.min(desiredHeight, upwards ? above : below))
      list.style.maxHeight = `${height}px`
      list.style.top = `${upwards ? rect.top - height - 6 : rect.bottom + 6}px`
    }
    // The browser's top layer keeps the menu clear of dialog and panel clipping.
    if (typeof list.showPopover === 'function') list.showPopover()
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    const observer = new ResizeObserver(position)
    observer.observe(list)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      if (typeof list.hidePopover === 'function' && list.matches(':popover-open'))
        list.hidePopover()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  useEffect(() => {
    if (open)
      document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, id])

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled || trigger.current?.matches(':disabled')) return
    if (native.current) {
      native.current.value = option.value
      native.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
    setInvalid(false)
    setOpen(false)
    trigger.current?.focus()
  }
  const move = (direction: number) => {
    for (let step = 1; step <= options.length; step++) {
      const index = (active + direction * step + options.length) % options.length
      if (!options[index].disabled) {
        setActive(index)
        break
      }
    }
  }

  return (
    <div
      className="select-control"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <span id={`${id}-label`} className="select-control-label">
        {label}
      </span>
      <select
        {...props}
        id={`${id}-native`}
        ref={native}
        hidden
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          setLocalValue(event.target.value)
          props.onChange?.(event)
        }}
        onInvalid={(event) => {
          event.preventDefault()
          setInvalid(true)
          trigger.current?.focus()
          props.onInvalid?.(event)
        }}
      >
        {children}
      </select>
      <button
        id={id}
        type="button"
        ref={trigger}
        className="select-trigger"
        role="combobox"
        disabled={props.disabled}
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-haspopup="listbox"
        aria-required={props.required}
        aria-invalid={invalid || props['aria-invalid']}
        aria-describedby={invalid ? `${id}-error` : props['aria-describedby']}
        aria-activedescendant={open && options[active] ? `${id}-option-${active}` : undefined}
        onClick={() => {
          setActive(Math.max(0, selected))
          setOpen(!open)
        }}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) event.preventDefault()
          if (event.key === 'Escape') {
            if (open) {
              event.preventDefault()
              setOpen(false)
              event.stopPropagation()
            }
            return
          }
          if (event.key === 'Tab') {
            setOpen(false)
            return
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!open) {
              setActive(Math.max(0, selected))
              setOpen(true)
            } else move(event.key === 'ArrowDown' ? 1 : -1)
          }
          if (event.key === 'Home' || event.key === 'End') {
            const index =
              event.key === 'Home'
                ? options.findIndex((o) => !o.disabled)
                : options.findLastIndex((o) => !o.disabled)
            setActive(Math.max(0, index))
            setOpen(true)
          }
          if (open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            choose(active)
          }
          if (
            event.key.length === 1 &&
            event.key !== ' ' &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const index = options.findIndex(
              (o) =>
                !o.disabled && String(o.label).toLowerCase().startsWith(event.key.toLowerCase()),
            )
            if (index >= 0) {
              setActive(index)
              setOpen(true)
            }
          }
        }}
      >
        {icon && <Icon name={icon} size={20} inheritColor />}
        <span id={`${id}-value`} className="select-value">
          {options[selected]?.label ?? 'Select an option'}
        </span>
        <span className="select-chevron">
          <Icon name="chevron-down" size={16} />
        </span>
      </button>
      {open && (
        <div
          ref={listbox}
          popover="manual"
          id={`${id}-listbox`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="select-options"
        >
          {options.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={active === index ? 'is-highlighted' : ''}
              onPointerMove={() => {
                if (!option.disabled) setActive(index)
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={20} inheritColor />}
            </button>
          ))}
          {!options.length && <span className="select-empty">No options available</span>}
        </div>
      )}
      {invalid && (
        <span id={`${id}-error`} className="field-error" role="alert">
          Please select an option.
        </span>
      )}
    </div>
  )
}
