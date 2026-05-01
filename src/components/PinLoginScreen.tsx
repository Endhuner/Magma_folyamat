/**
 * PIN-alapú bejelentkezés képernyő.
 *
 * Lépések:
 *  1) felhasználó-választás (publikus lista a `/auth/users-public`-ből)
 *  2) 4-8 számjegyű PIN-kód begépelése
 *  3) `useAuth().login(userId, pin)` — siker után a router-szülő (`App.tsx`)
 *     elnavigál az appra
 *
 * Erő-tényezők:
 *  - autoFocus a PIN-mezőn, a numeric keypadhoz inputMode='numeric'
 *  - Enter-rel submit, ESC-szel "vissza a felhasználó-listához"
 *  - dummy submit-tiltás amíg fut a request — duplaklikk védelem
 *  - lokalizált hibák (a backend Hungarian error stringeket küld)
 */
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactElement } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useAuth, type PublicUser, type UserRole } from '@/lib/auth'
import { Factory, ArrowLeft, ShieldCheck } from '@phosphor-icons/react'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Adminisztrátor',
  operator: 'Operátor',
  viewer: 'Megfigyelő',
}

function roleVariant(role: UserRole): 'default' | 'secondary' | 'outline' {
  switch (role) {
    case 'admin':
      return 'default'
    case 'operator':
      return 'secondary'
    default:
      return 'outline'
  }
}

export function PinLoginScreen(): ReactElement {
  const auth = useAuth()
  const publicUsers = Array.isArray(auth.publicUsers) ? auth.publicUsers : []
  const { login, refreshPublicUsers, error } = auth
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null)
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  /**
   * Kliensoldali brute-force védelem: 3 hibás kísérlet után kötelező 30s
   * várakozás, majd minden további hiba megduplázza a cooldownt (max 5 perc).
   * Ez nem helyettesíti a szerveroldali rate-limitet (az is kell), de
   * megállítja a tipikus „kis fivér" támadásokat (egy felhasználó próbálgatja
   * a kollégájának PINjét).
   */
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!lockoutUntil) return
    const handle = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(handle)
  }, [lockoutUntil])

  const lockedRemainingSec = lockoutUntil
    ? Math.max(0, Math.ceil((lockoutUntil - now) / 1000))
    : 0
  const isLocked = lockedRemainingSec > 0

  // Sürgős lista-frissítés ha üres (pl. backend később indult)
  useEffect(() => {
    if (publicUsers.length === 0) {
      void refreshPublicUsers()
    }
  }, [publicUsers.length, refreshPublicUsers])

  useEffect(() => {
    if (selectedUser && pinInputRef.current) {
      pinInputRef.current.focus()
    }
  }, [selectedUser])

  const sortedUsers = useMemo(() => {
    return [...publicUsers].sort((a, b) => {
      // Admin elsőre, aztán név szerint
      if (a.role === 'admin' && b.role !== 'admin') return -1
      if (b.role === 'admin' && a.role !== 'admin') return 1
      return a.name.localeCompare(b.name, 'hu')
    })
  }, [publicUsers])

  const pinValid = /^\d{4,8}$/.test(pin)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!selectedUser || !pinValid || submitting || isLocked) return
    setLocalError(null)
    setSubmitting(true)
    try {
      await login(selectedUser.id, pin)
      // siker — reset counters és a parent kicseréli a layoutot
      setFailedAttempts(0)
      setLockoutUntil(null)
    } catch (err) {
      const nextFailed = failedAttempts + 1
      setFailedAttempts(nextFailed)
      if (nextFailed >= 3) {
        // 30s, 60s, 120s, 240s, 300s (cap)
        const cooldownSec = Math.min(300, 30 * Math.pow(2, nextFailed - 3))
        setLockoutUntil(Date.now() + cooldownSec * 1000)
      }
      setLocalError(err instanceof Error ? err.message : 'Bejelentkezési hiba')
      setPin('')
      pinInputRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  function back(): void {
    setSelectedUser(null)
    setPin('')
    setLocalError(null)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <Factory size={28} weight="duotone" className="text-primary" />
            <CardTitle className="text-2xl">ProduktívPro</CardTitle>
          </div>
          <CardDescription>
            {selectedUser
              ? `Add meg a PIN-kódodat — ${selectedUser.name}`
              : 'Válaszd ki a felhasználódat a folytatáshoz'}
          </CardDescription>
        </CardHeader>

        {!selectedUser && (
          <CardContent>
            {sortedUsers.length === 0 ? (
              <Alert>
                <AlertDescription>
                  Nincs aktív felhasználó. Az adminisztrátor először létrehoz egyet a master-data
                  felületen, vagy állítsd be a <code>DEFAULT_ADMIN_PIN</code> env-változót a backenden.
                </AlertDescription>
              </Alert>
            ) : (
              <ul className="space-y-2">
                {sortedUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className="w-full flex items-center justify-between rounded-md border bg-card px-4 py-3 text-left transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-medium">{u.name}</span>
                      <Badge variant={roleVariant(u.role)}>{ROLE_LABEL[u.role]}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        )}

        {selectedUser && (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pin">PIN-kód</Label>
                <Input
                  ref={pinInputRef}
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{4,8}"
                  minLength={4}
                  maxLength={8}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
                    setPin(v)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      back()
                    }
                  }}
                  disabled={submitting || isLocked}
                  className="text-center text-2xl tracking-[0.5em]"
                />
                <p className="text-xs text-muted-foreground">
                  4–8 számjegy. Biztonsági okból a kód nem látható.
                </p>
              </div>
              {isLocked && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Túl sok hibás kísérlet. Próbáld újra {lockedRemainingSec}{' '}
                    másodperc múlva.
                  </AlertDescription>
                </Alert>
              )}
              {!isLocked && (localError || error) && (
                <Alert variant="destructive">
                  <AlertDescription>{localError || error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                type="submit"
                className="w-full"
                disabled={!pinValid || submitting || isLocked}
              >
                <ShieldCheck size={18} weight="bold" className="mr-2" />
                {submitting
                  ? 'Bejelentkezés…'
                  : isLocked
                    ? `Várakozás… (${lockedRemainingSec}s)`
                    : 'Belépés'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={back}
                disabled={submitting}
              >
                <ArrowLeft size={16} className="mr-2" />
                Vissza a felhasználó-listához
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  )
}
