import { createContext, useContext } from 'react'
import type { AppShellValue } from './shellTypes'

export const AppShellContext = createContext<AppShellValue | null>(null)

/** Az App-shell adatai/handlerei az oldalak számára. Csak a Provider alatt hívható. */
export function useAppShell(): AppShellValue {
  const v = useContext(AppShellContext)
  if (!v) throw new Error('useAppShell csak az AppShellContext.Provider alatt hívható')
  return v
}
