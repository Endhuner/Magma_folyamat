/**
 * Deklaratív role-gate UI-elem. Akkor render-eli a children-t, ha a current
 * user beletartozik az `allowed` listába. Egyébként a `fallback`-et.
 *
 * Használat:
 *
 *   <RoleGate allowed={['admin']}>
 *     <Button>Felhasználó törlése</Button>
 *   </RoleGate>
 *
 *   <RoleGate allowed={['admin', 'operator']} fallback={<Locked />}>
 *     <ProductionView />
 *   </RoleGate>
 */
import type { ReactElement, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import type { UserRole } from './types'

interface RoleGateProps {
  allowed: UserRole[]
  children: ReactNode
  fallback?: ReactNode
}

export function RoleGate({ allowed, children, fallback = null }: RoleGateProps): ReactElement {
  const { hasRole } = useAuth()
  return <>{hasRole(...allowed) ? children : fallback}</>
}
