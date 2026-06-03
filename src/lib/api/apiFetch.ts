/**
 * apiFetch — közös API-hívó segéd.
 *
 * Egy helyen kezeli a visszatérő dolgokat, amik eddig minden hívásnál
 * ismétlődtek:
 *   - `credentials: 'include'` (a JWT httpOnly cookie miatt mindenhol kell)
 *   - egységes `/api/v1` előtag (VITE_API_BASE_URL támogatással)
 *   - JSON Content-Type beállítása, ha body van
 *   - hibás (non-2xx) válasz → beszédes Error a status mezővel
 *
 * A 401 (lejárt munkamenet) kezelését a globális sessionWatch végzi —
 * ide nem kell külön logika.
 */

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
  ''

export function apiUrl(path: string): string {
  // Engedjük az abszolút útvonalat is (pl. '/health'), de a relatívokat
  // a /api/v1 alá tesszük.
  if (path.startsWith('http')) return path
  if (path.startsWith('/api/')) return `${API_BASE}${path}`
  return `${API_BASE}/api/v1${path.startsWith('/') ? path : `/${path}`}`
}

export interface ApiError extends Error {
  status?: number
  body?: unknown
}

/**
 * JSON-alapú API-hívás. Sikeres válasznál a parse-olt body-t adja vissza
 * (T típusúként). Hibánál Error-t dob `status` és `body` mezővel.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {})
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
    headers,
  })

  const contentType = res.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  let body: unknown = null
  try {
    body = isJson ? await res.json() : await res.text()
  } catch {
    /* üres body OK */
  }

  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body &&
        typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) || `API hiba (${res.status})`
    const err = new Error(message) as ApiError
    err.status = res.status
    err.body = body
    throw err
  }

  return body as T
}
