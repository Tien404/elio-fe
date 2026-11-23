import { vietnamDayBoundary } from '@/services/assessment-time'
import { useCallback, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button, DataTable, Field, Panel, Status } from '@/components/ui'
import { LoadState, Pager, Select } from '@/components/workspace/WorkspaceUI'
import { AccountDialog, type AccountOperation } from '@/components/personal/AccountDialog'
import { WorkspaceAccessContext } from '@/services/workspace-access-context'
import { apiMode, services } from '@/services'
import { useResource } from '@/services/use-resource'
import { useAuth } from '@/services/auth-context'
import { formatInstant } from '@/services/presentation'
export function Admin() {
  const { identity } = useAuth()
  if (identity!.me.account.role !== 'ADMIN')
    return (
      <div className="course-workspace">
        <h1>Access denied</h1>
        <Status error>Administrator operational access is required.</Status>
        <Link to="/dashboard">Go to dashboard</Link>
      </div>
    )
  return <Administration />
}

function Administration() {
  const { identity } = useAuth(),
    [params, setParams] = useSearchParams(),
    auditOnly = params.get('tab') === 'audit',
    search = params.get('search') ?? '',
    status = params.get('status') ?? 'ALL',
    role = params.get('role') ?? 'ALL',
    page = Number(params.get('page')) || 1,
    auditSearch = params.get('auditSearch') ?? '',
    auditAction = params.get('auditAction') ?? '',
    auditActor = params.get('auditActor') ?? '',
    auditOffering = params.get('auditOffering') ?? '',
    auditFrom = params.get('auditFrom') ?? '',
    auditTo = params.get('auditTo') ?? '',
    auditTarget = params.get('auditTarget') ?? '',
    auditPage = Number(params.get('auditPage')) || 1,
    [dialog, setDialog] = useState<{
      kind: AccountOperation
      account?: Awaited<ReturnType<typeof services.admin.accounts>>['items'][number]
    }>(),
    load = useCallback(
      () => services.admin.accounts({ search, status, role, page }),
      [search, status, role, page],
    ),
    r = useResource(load, `admin:${search}:${role}:${status}:${page}`, { retainOnError: true }),
    auditLoad = useCallback(
      () =>
        services.admin.audit({
          search: auditSearch,
          action: auditAction,
          page: auditPage,
          actorId: Number(auditActor) || undefined,
          offeringId: Number(auditOffering) || undefined,
          fromAt: auditFrom ? (vietnamDayBoundary(auditFrom) ?? undefined) : undefined,
          toAt: auditTo ? (vietnamDayBoundary(auditTo, true) ?? undefined) : undefined,
          targetType: auditTarget || undefined,
        }),
      [
        auditSearch,
        auditAction,
        auditPage,
        auditActor,
        auditOffering,
        auditFrom,
        auditTo,
        auditTarget,
      ],
    ),
    audit = useResource(
      auditLoad,
      `admin-audit:${auditSearch}:${auditAction}:${auditPage}:${auditActor}:${auditOffering}:${auditFrom}:${auditTo}:${auditTarget}`,
    )
  function filter(k: string, v: string) {
    setParams((p) => {
      p.set(k, v)
      p.delete(k.startsWith('audit') ? 'auditPage' : 'page')
      return p
    })
  }
  return (
    <WorkspaceAccessContext.Provider
      value={r.error ? { error: r.error, retry: r.reload } : undefined}
    >
      <div className="course-workspace">
        <h1>{auditOnly ? 'Operational audit log' : 'Account administration'}</h1>
        {auditOnly && (
          <Link className="button secondary" to="/admin">
            Back to accounts
          </Link>
        )}
        {!auditOnly && (
          <>
            <Panel
              title="Accounts"
              icon="people-small"
              actions={
                <Button onClick={() => setDialog({ kind: 'create' })}>Create account</Button>
              }
            >
              <div className="filters">
                <Field
                  label="Search accounts"
                  maxLength={apiMode ? 200 : undefined}
                  value={search}
                  onChange={(e) => filter('search', e.target.value)}
                />
                <Select
                  label="Account status"
                  value={status}
                  onChange={(e) => filter('status', e.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="LOCKED">Locked</option>
                </Select>
                <Select
                  label="System role"
                  value={role}
                  onChange={(e) => filter('role', e.target.value)}
                >
                  <option value="ALL">All roles</option>
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Administrator</option>
                </Select>
              </div>
              <LoadState {...r} retry={r.reload} />
              {r.data && !r.error && (
                <>
                  <DataTable
                    className="admin-accounts-table"
                    rows={r.data.items}
                    rowKey={(a) => a.account.id}
                    columns={[
                      {
                        label: 'Account',
                        render: (a) => `${a.account.displayName} · ${a.account.id}`,
                      },
                      { label: 'Identifier', render: (a) => a.email },
                      { label: 'Role', render: (a) => a.account.role },
                      { label: 'State', render: (a) => a.account.status },
                      {
                        label: 'Create courses',
                        render: (a) => (a.canCreateCourse ? 'Yes' : 'No'),
                      },
                      {
                        label: 'Actions',
                        render: (a) => (
                          <div className="actions">
                            <Button
                              tone="secondary"
                              onClick={() => setDialog({ kind: 'reset', account: a })}
                            >
                              Temporary password reset
                            </Button>
                            {(!apiMode || a.account.id !== identity!.me.account.id) && (
                              <Button
                                tone="secondary"
                                onClick={() =>
                                  setDialog({
                                    kind: a.account.status === 'LOCKED' ? 'unlock' : 'lock',
                                    account: a,
                                  })
                                }
                              >
                                {a.account.status === 'LOCKED' ? 'Unlock' : 'Lock'}
                              </Button>
                            )}
                            {a.account.role === 'INSTRUCTOR' && (
                              <Button onClick={() => setDialog({ kind: 'capability', account: a })}>
                                Course-creation permission
                              </Button>
                            )}
                          </div>
                        ),
                      },
                    ]}
                  />
                  {!r.data.totalItems && <Status>No accounts match these filters.</Status>}
                  <Pager
                    value={r.data}
                    change={(p) =>
                      setParams((s) => {
                        s.set('page', String(p))
                        return s
                      })
                    }
                  />
                </>
              )}
            </Panel>
            <Panel title="Course metadata" icon="book-small">
              <p>
                Course metadata and staffing operations are available in Course sections. Academic
                content is governed by teaching membership.
              </p>
              <div className="actions">
                <Link className="button secondary" to="/offerings">
                  Search course sections
                </Link>
                <Link className="button secondary" to="/courses">
                  Course catalog
                </Link>
                <Link className="button secondary" to="/admin?tab=audit">
                  Audit log
                </Link>
              </div>
            </Panel>
          </>
        )}
        <Panel title="Audit log" icon="info">
          <Field
            label={apiMode ? 'Filter by action code' : 'Search audit log'}
            maxLength={apiMode ? 100 : undefined}
            placeholder={apiMode ? 'e.g. LEAD_TRANSFERRED' : undefined}
            value={apiMode ? auditAction : auditSearch}
            onChange={(e) => filter(apiMode ? 'auditAction' : 'auditSearch', e.target.value)}
          />
          <div className="form-grid">
            <Field
              label="Actor ID"
              type="number"
              min={1}
              value={auditActor}
              onChange={(e) => filter('auditActor', e.target.value)}
            />
            <Field
              label="Course section ID"
              type="number"
              min={1}
              value={auditOffering}
              onChange={(e) => filter('auditOffering', e.target.value)}
            />
            <Field
              label="Object type"
              maxLength={80}
              value={auditTarget}
              onChange={(e) => filter('auditTarget', e.target.value.toUpperCase())}
            />
            <Field
              label="From date (Vietnam)"
              type="date"
              value={auditFrom}
              onChange={(e) => filter('auditFrom', e.target.value)}
            />
            <Field
              label="Through date (Vietnam)"
              type="date"
              value={auditTo}
              onChange={(e) => filter('auditTo', e.target.value)}
            />
          </div>
          <LoadState {...audit} retry={audit.reload} />
          {audit.data && !audit.error && (
            <>
              <DataTable
                rows={audit.data.items}
                rowKey={(a) => a.key}
                columns={[
                  { label: 'Actor', render: (a) => a.actorId },
                  { label: 'Action', render: (a) => a.action },
                  { label: 'Timestamp', render: (a) => formatInstant(a.occurredAt) },
                  { label: 'Object', render: (a) => `${a.targetKind} · ${a.targetId}` },
                  { label: 'Reason', render: (a) => a.reason ?? '—' },
                ]}
              />
              {!audit.data.totalItems && <Status>No operational audit entries match.</Status>}
              <Pager
                value={audit.data}
                change={(p) =>
                  setParams((s) => {
                    s.set('auditPage', String(p))
                    return s
                  })
                }
              />
            </>
          )}
        </Panel>
        {dialog && (
          <AccountDialog {...dialog} close={() => setDialog(undefined)} reload={r.reload} />
        )}
      </div>
    </WorkspaceAccessContext.Provider>
  )
}
