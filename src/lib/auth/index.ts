/**
 * Auth-modul nyilvános felülete. A többi frontend-kód innen importál:
 *
 *   import { useAuth, RoleGate } from '@/lib/auth'
 */
export * from './types'
export { AuthProvider, useAuth, useHasRole } from './AuthContext'
export { RoleGate } from './RoleGate'
export * as authApi from './authApi'
