/**
 * Auth API kliens — Phase 3.
 *
 * A `credentials: 'include'` minden hívásnál szükséges, mert a JWT a
 * httpOnly cookie-ban él, és a böngésző csak így küldi vissza CORS-on át.
 *
 * A backend host-ot a `VITE_API_BASE_URL` env-változó adja; ha nincs,
 * relatív útvonalakat használunk (ez a prod-prepárorisi alapeset, mivel
 * a binhex-nginx ugyanazon a host-on szolgál ki frontent + API-t).
 */
import type { CurrentUser, PublicUser } from './types'

const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
  ''

function url(path: string): string {
  return `${API_BASE}/api/v1${path}`
}

/**
 * Fetch wrapper, amely a hálózati hibákat (backend nem elérhető) másféle
 * exception-né alakítja, hogy a UI megkülönböztesse a 401-től.
 */
export class BackendUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('A backend nem elérhető')
    this.name = 'BackendUnavailableError'
    if (cause) (this as { cause?: unknown }).cause = cause
  }
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (err) {
    // TypeError: Failed to fetch — backend down vagy CORS-blokk
    throw new BackendUnavailableError(err)
  }
}

async function parseJsonOrThrow<T>(res: Response, fallbackError: string): Promise<T> {
  // Ha nem JSON a content-type, a backend nincs ott (Vite SPA-fallback HTML-t,
  // vagy egy proxy/nginx adott vissza valamit). Ezt backend-unavailable-ként
  // kezeljük, hogy a UI elnavigálhasson a fallback képernyőre.
  const contentType = res.headers.get('content-type') || ''
  const looksJson = contentType.includes('application/json')

  let body: unknown = null
  try {
    body = looksJson ? await res.json() : await res.text()
  } catch {
    /* empty body OK */
  }
  if (!res.ok) {
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : null) || fallbackError
    const err = new Error(message) as Error & { status?: number; body?: unknown }
    err.status = res.status
    err.body = body
    throw err
  }
  if (!looksJson) {
    // 200 OK, de HTML/szöveg jött vissza — backend route nem létezik,
    // dev-szerveren ez a tipikus jelenség (Vite SPA-fallback).
    throw new BackendUnavailableError(
      new Error(`Váratlan content-type a ${res.url}-on: "${contentType}"`)
    )
  }
  return body as T
}

export async function login(userId: string, pin: string): Promise<CurrentUser> {
  const res = await safeFetch(url('/auth/login'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, pin }),
  })
  return parseJsonOrThrow<CurrentUser>(res, 'Hibás felhasználó vagy PIN')
}

export async function logout(): Promise<void> {
  const res = await safeFetch(url('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok && res.status !== 401) {
    throw new Error('Kijelentkezés sikertelen')
  }
}

/**
 * `me` — a session-cookie alapján visszaadja a current usert. 401-re null,
 * más hibára exception. Ezzel induláskor el tudjuk dönteni, hogy
 * mutassuk-e a login-screent vagy egyenest a appot.
 */
export async function me(): Promise<CurrentUser | null> {
  const res = await safeFetch(url('/auth/me'), {
    credentials: 'include',
  })
  if (res.status === 401) return null
  return parseJsonOrThrow<CurrentUser>(res, 'Nem sikerült lekérni a felhasználót')
}

export async function getPublicUsers(): Promise<PublicUser[]> {
  const res = await safeFetch(url('/auth/users-public'))
  return parseJsonOrThrow<PublicUser[]>(res, 'Nem sikerült betölteni a felhasználókat')
}
