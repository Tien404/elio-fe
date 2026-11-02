import { createContext } from 'react'
export const WorkspaceAccessContext = createContext<{ error: Error; retry(): void } | undefined>(
  undefined,
)
