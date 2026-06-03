/**
 * sessionWatch — globális 401-figyelő.
 *
 * Miért kell?
 *   A szerver-munkamenet (JWT cookie) a SESSION_TTL_SECONDS (alapból 8 óra)
 *   után lejár. Ilyenkor a következő API-hívás `401`-et ad vissza, DE a kliens
 *   auth-állapota magától nem változik — a felhasználó "beragad" az aktuális
 *   oldalon, működésképtelen UI-val.
 *
 * Mit csinál?
 *   Egyetlen helyen "becsomagolja" a globális `window.fetch`-et, és ha bármelyik
 *   API-hívás (/api/v1/...) 401-et ad, kibocsát egy `auth:session-expired`
 *   eseményt. Az AuthProvider erre átvált `unauthenticated`-re → az AuthGate
 *   azonnal a bejelentkezési képernyőt mutatja.
 *
 * A login végpont 401-jét (rossz PIN) szándékosan kihagyjuk, hogy ne keverjük
 * össze a hibás belépést a lejárt munkamenettel.
 */

export const SESSION_EXPIRED_EVENT = 'auth:session-expired'

let installed = false

/** Kinyeri a kért URL-t a fetch argumentumból (string | URL | Request). */
function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url
  return String(input)
}

/**
 * Egyszer telepíti a globális fetch-figyelőt. Idempotens — többszöri hívás
 * esetén sem csomagol be újra.
 */
export function installSessionWatch(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return
  }
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init)
    try {
      if (response.status === 401) {
        const reqUrl = extractUrl(input)
        const isApi = reqUrl.includes('/api/v1/')
        const isLogin = reqUrl.includes('/api/v1/auth/login')
        if (isApi && !isLogin) {
          window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT))
        }
      }
    } catch {
      /* a figyelő soha ne dobjon el egy érvényes választ */
    }
    return response
  }
}
