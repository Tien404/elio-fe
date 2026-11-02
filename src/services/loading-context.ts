import { createContext } from 'react'

export const LoadingContext = createContext<((id: string) => () => void) | null>(null)
