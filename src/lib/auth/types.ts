/**
 * Frontend auth típusok. A backend `@produktivpro/shared` csomagjával
 * tükrözött, de itt is meg van duplikálva, hogy a frontend-csomag ne
 * függjön közvetlenül a backend-buildtől (Vite/build idő).
 */

export type UserRole = 'admin' | 'operator' | 'viewer'

export interface CurrentUser {
  id: string
  name: string
  role: UserRole
  /** Felhasználónkénti megjelenés (skin) — '' = alap. */
  skin?: string
}

export interface PublicUser {
  id: string
  name: string
  role: UserRole
}

export type AuthStatus =
  | 'unknown'
  | 'unauthenticated'
  | 'authenticated'
  /** Backend nem elérhető — fejlesztés alatt, vagy hálózati hiba. */
  | 'backend-unavailable'
  /** A felhasználó tudatosan átugrotta az auth-gate-et (offline mód). */
  | 'bypass'

export interface AuthState {
  status: AuthStatus
  user: CurrentUser | null
  /** A `users-public` listából, a login screen tölti elsőként. */
  publicUsers: PublicUser[]
  /** Utolsó auth-művelet hibaüzenete (login fail, network, stb.). */
  error: string | null
}
