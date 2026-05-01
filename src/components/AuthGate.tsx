/**
 * AuthGate — a teljes app-szintű auth-router.
 *
 * Állapotok:
 *  - `unknown`              → loading splash (a /me éppen fut)
 *  - `unauthenticated`      → PinLoginScreen
 *  - `backend-unavailable`  → barátságos képernyő, "Folytatás backend nélkül"
 *  - `bypass` / `authenticated` → children (a sima App)
 *
 * Phase 3 gradual rollout: ha valaki "csak nézzem át" módban szeretne
 * dolgozni, a `VITE_AUTH_OPTIONAL=true` env-változóval automatikusan
 * bypass-ra ugrik.
 */
import { useEffect, type ReactElement, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { PinLoginScreen } from './PinLoginScreen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Factory, WifiSlash, Play } from '@phosphor-icons/react'

const AUTH_OPTIONAL: boolean =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_AUTH_OPTIONAL === 'true') || false

export function AuthGate({ children }: { children: ReactNode }): ReactElement {
  const { status, bypassAuth, refresh } = useAuth()

  // Ha a fejlesztő bekapcsolta a VITE_AUTH_OPTIONAL-t, a backend-unavailable
  // és unauthenticated esetén automatikusan bypass-ra ugrunk.
  useEffect(() => {
    if (
      AUTH_OPTIONAL &&
      (status === 'unauthenticated' || status === 'backend-unavailable')
    ) {
      bypassAuth()
    }
  }, [status, bypassAuth])

  if (status === 'unknown') {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
        <Factory size={36} weight="duotone" className="text-primary animate-pulse" />
        <p className="text-sm">Bejelentkezés ellenőrzése…</p>
      </div>
    )
  }

  if (status === 'backend-unavailable') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <WifiSlash size={28} weight="duotone" className="text-amber-500" />
              <CardTitle className="text-2xl">Backend nem elérhető</CardTitle>
            </div>
            <CardDescription>
              A bejelentkezési és szerver-szolgáltatások jelenleg nem érhetőek el.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Alert>
              <AlertDescription className="text-sm leading-relaxed">
                Ha csak a felületet szeretnéd látni, folytathatod backend nélkül —
                ilyenkor a localStorage-ben tárolt adatok lesznek elérhetőek és
                a multigép-szinkron, audit-log nem fog működni.
                <br />
                <br />
                Ha a backend-et szeretnéd elindítani, lásd a <code>deploy/README.md</code> fájlt
                (npm install, majd <code>npm run dev</code> a <code>apps/api</code> mappában),
                vagy állítsd be a <code>VITE_API_BASE_URL</code> env-változót, ha más hoston fut.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button className="w-full" onClick={bypassAuth}>
              <Play size={18} weight="bold" className="mr-2" />
              Folytatás backend nélkül
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => void refresh()}>
              Újrapróbálkozás
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <PinLoginScreen />
  }

  // 'authenticated' vagy 'bypass'
  return <>{children}</>
}
