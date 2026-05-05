/**
 * AuthContext + AuthProvider — frontend auth state.
 *
 * Felelős:
 *  - induláskor egyszer hív a `/auth/me`-re, hogy beállítsa a `status`-t
 *  - login / logout actiont biztosít a UI-nak
 *  - useAuth() hookkal exportálja a state-et + actionöket
 *  - useRequireRole(...allowed) — egy egyszerű guard, amely a UI-ban
 *    visszadob `null`-t (vagy fallbacket), ha a role nem egyezik
 *  - Inaktivitás-figyelés: 5 óra után 1 perces visszaszámláló dialog,
 *    utána automatikus kijelentkezés
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/** 5 óra inaktivitás után figyelmeztetés — milliszekundumban. */
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 60 * 1000

/** A figyelmeztetés után ennyi másodperccel lép ki automatikusan. */
const WARNING_SECONDS = 60

/** Az aktivitásnak minősülő böngésző-események listája. */
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
]

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

  // Inaktivitás timer
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(WARNING_SECONDS)
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    // Timer takarítás kijelentkezéskor
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setShowWarning(false)
    try {
      await authApi.logout()
    } finally {
      setState((s) => ({ ...s, status: 'unauthenticated', user: null }))
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Inaktivitás figyelő
  // ---------------------------------------------------------------------------

  /**
   * Elindítja (vagy újraindítja) az inaktivitás-timert.
   * Ha a figyelmeztetés aktív volt, azt is bezárja.
   */
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    setShowWarning(false)
    setCountdown(WARNING_SECONDS)

    inactivityTimerRef.current = setTimeout(() => {
      // 5 óra eltelt aktivitás nélkül → figyelmeztetés megjelenítése
      setShowWarning(true)
      setCountdown(WARNING_SECONDS)

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownIntervalRef.current!)
            // Automatikus kijelentkezés
            void doLogout()
            return 0
          }
          return prev - 1
        })
      }, 1_000)
    }, INACTIVITY_TIMEOUT_MS)
  }, [doLogout])

  /**
   * Bekapcsolja az aktivitás-figyelőket, ha a user be van jelentkezve.
   * Kikapcsolja + törli a timereket, ha kijelentkezik.
   */
  useEffect(() => {
    const isActive = state.status === 'authenticated'

    if (!isActive) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      setShowWarning(false)
      return
    }

    // Első indítás bejelentkezéskor
    resetInactivityTimer()

    const handleActivity = () => resetInactivityTimer()
    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, handleActivity, { passive: true }))

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, handleActivity))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

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

  return (
    <AuthContext.Provider value={value}>
      {children}

      {/* Inaktivitás-figyelmeztetés dialog */}
      <Dialog open={showWarning} onOpenChange={() => { /* csak gombbal zárható */ }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>⚠️ Automatikus kijelentkezés</DialogTitle>
            <DialogDescription>
              Hosszabb ideig nem volt aktivitás. Biztonsági okokból{' '}
              <strong>{countdown} másodperc</strong> múlva automatikusan kijelentkezünk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end mt-4">
            <Button
              variant="outline"
              onClick={() => void doLogout()}
            >
              Kijelentkezés most
            </Button>
            <Button onClick={resetInactivityTimer}>
              Maradok bejelentkezve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AuthContext.Provider>
  )
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
