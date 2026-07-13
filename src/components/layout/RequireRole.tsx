import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import type { UserRole } from '@/lib/auth'
import { defaultPathFor } from '@/lib/navigation'

/** Route-őr: tiltott szerepkörnél a szerepkör kezdőoldalára irányít.
 *  Bypass módban (nincs backend) minden oldal elérhető. */
export function RequireRole({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const auth = useAuth()
  if (auth.status !== 'bypass' && auth.user && !allowed.includes(auth.user.role)) {
    return <Navigate to={defaultPathFor(auth.user.role)} replace />
  }
  return <>{children}</>
}
