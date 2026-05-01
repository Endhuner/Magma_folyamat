/**
 * AuthContext + AuthProvider — frontend auth state.
 *
 * Felelős:
 *  - induláskor egyszer hív a `/auth/me`-re, hogy beállítsa a `status`-t
 *  - login / logout actiont biztosít a UI-nak
 *  - useAuth() hookkal exportálja a state-et + actionöket
 *  - useRequireRole(...allowed) — egy egyszerű guard, amely a UI-ban
 *    visszadob `null`-t (vagy fallbacket), ha a role nem egyezik
 *
 * Külső redux/zustand nem kell — ez egy kis felület, a React context
 * elég. A storage-mentés tudatos hiánya: a JWT egyébként cookie-ban van,
 * a localStorage-ot ne is hagyjuk megkísérteni.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import * as authApi from './authApi'
import { BackendUnavailableError } from './authApi'
import type { AuthState, CurrentUser, PublicUser, UserRole } from './types'

interface AuthContextValue extends AuthState {
  login: (userId: string, pin: string) => Promise<CurrentUser>
  logout: () => Promise<void>
  refreshPublicUsers: () => Promise<void>
  /** Megengedi-e a megadott role-knak. Ha üres a lista, csak bejelentkezést követel. */
  hasRole: (...allowed: UserRole[]) => boolean
  /** Frissíti a `me` állapotot — pl. PIN-csere után. */
  refresh: () => Promise<void>
  /** Megengedi a usernek, hogy backend nélkül is folytassa (csak fejlesztéshez). */
  bypassAuth: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const initialState: AuthState = {
  status: 'unknown',
  user: null,
  publicUsers: [],
  error: null,
}

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const [state, setState] = useState<AuthState>(initialState)
  const bootedRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const user = await authApi.me()
      setState((s) => ({
        ...s,
        status: user ? 'authenticated' : 'unauthenticated',
        user,
        error: null,
      }))
    } catch (err) {
      const isNetwork = err instanceof BackendUnavailableError
      setState((s) => ({
        ...s,
        status: isNetwork ? 'backend-unavailable' : 'unauthenticated',
        user: null,
        error: err instanceof Error ? err.message : 'Ismeretlen hiba',
      }))
    }
  }, [])

  const refreshPublicUsers = useCallback(async () => {
    try {
      const users = await authApi.getPublicUsers()
      // Defenzív — ha valamiért nem array, ne dőljön el a UI:
      const safe: PublicUser[] = Array.isArray(users) ? users : []
      setState((s) => ({ ...s, publicUsers: safe }))
    } catch (err) {
      const isNetwork = err instanceof BackendUnavailableError
      setState((s) => ({
        ...s,
        publicUsers: [],
        // Ha eddig az auth-status `unauthenticated` volt, de most kiderült,
        // hogy a backend nem is válaszol, frissítsük át — a UI így a
        // "Backend nem elérhető" képernyőre tud navigálni.
        status: isNetwork && s.status !== 'authenticated' ? 'backend-unavailable' : s.status,
        error: err instanceof Error ? err.message : 'Ismeretlen hiba',
      }))
    }
  }, [])

  const doLogin = useCallback(async (userId: string, pin: string) => {
    try {
      const user = await authApi.login(userId, pin)
      setState((s) => ({ ...s, status: 'authenticated', user, error: null }))
      return user
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bejelentkezési hiba'
      setState((s) => ({ ...s, error: msg }))
      throw err
    }
  }, [])

  const doLogout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setState((s) => ({ ...s, status: 'unauthenticated', user: null }))
    }
  }, [])

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    void refresh()
    void refreshPublicUsers()
  }, [refresh, refreshPublicUsers])

  const bypassAuth = useCallback(() => {
    setState((s) => ({ ...s, status: 'bypass', user: null, error: null }))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: doLogin,
      logout: doLogout,
      refresh,
      refreshPublicUsers,
      bypassAuth,
      hasRole: (...allowed: UserRole[]) => {
        // Bypass módban (offline / dev) mindenki "admin" — különben az
        // admin-only gombok eltűnnének és a UI használhatatlanná válna.
        if (state.status === 'bypass') return true
        if (!state.user) return false
        if (allowed.length === 0) return true
        return allowed.includes(state.user.role)
      },
    }),
    [state, doLogin, doLogout, refresh, refreshPublicUsers, bypassAuth]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth() csak <AuthProvider> alatt használható')
  }
  return ctx
}

/**
 * Useful hook UI-szigeteléshez. Például egy gombot nem renderelünk, ha
 * nincs admin jog:
 *
 *   const canManage = useHasRole('admin')
 *   {canManage && <Button>Új felhasználó</Button>}
 */
export function useHasRole(...allowed: UserRole[]): boolean {
  const { hasRole } = useAuth()
  return hasRole(...allowed)
}
