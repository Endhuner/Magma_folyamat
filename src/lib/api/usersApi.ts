/**
 * Felhasználó CRUD-kliens — backend `/api/v1/users` endpoint felé.
 *
 * Egyetlen felelőssége: a frontend "Felhasználók" tabja innen olvas/ír.
 * Mindenhol `credentials: 'include'`, mert a Phase 3 auth a JWT-t
 * httpOnly cookie-ban tárolja, és a backend `permissions: { create: ['admin'] }`
 * szigorítása csak így tud olvasni a sessiont.
 *
 * Architektúra-megjegyzés: a PIN-t **soha nem hash-eljük itt**. A backend
 * `transformUserInput` fogadja a `pin` mezőt, bcrypt-eli, és `pinHash`-be
 * teszi. A `pinHash` mező **soha nem érkezik vissza** (a `redactUserOutput`
 * eltávolítja), tehát biztonságos volt a User-objektumot úgy ide-oda dobálni,
 * hogy a háttérben tárolt hash sose legyen kliens-oldali.
 */
import type { User, UserRole } from '@produktivpro/shared'
import { BackendUnavailableError } from '../auth/authApi'

/** API base — ugyanaz a logika, mint az authApi-ban (egy proxy alá tartoznak). */
const API_BASE: string =
  (typeof import.meta !== 'undefined' &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE_URL) ||
  ''

function url(path: string): string {
  return `${API_BASE}/api/v1${path}`
}

async function safeFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, { credentials: 'include', ...init })
  } catch (err) {
    throw new BackendUnavailableError(err)
  }
}

/**
 * Egységes hibakezelés: a backend Hungarian üzeneteit a `error` mezőből
 * vesszük; ha nincs JSON, generikus üzenet.
 */
async function handleResponse<T>(res: Response, fallbackError: string): Promise<T> {
  const ct = res.headers.get('content-type') || ''
  const looksJson = ct.includes('application/json')
  let body: unknown = null
  try {
    body = looksJson ? await res.json() : await res.text()
  } catch {
    /* üres body OK */
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
    // 200 OK, de nem JSON — pl. Vite SPA-fallback HTML-t adott vissza
    throw new BackendUnavailableError(
      new Error(`Váratlan content-type a ${res.url}-on: "${ct}"`)
    )
  }
  return body as T
}

/** Részleges create-bemenet — `pin` opcionális, mert nélküle a usert "olvasónak" hozzuk létre. */
export interface UserCreateInput {
  name: string
  email?: string
  role?: UserRole
  notes?: string
  /** 4–8 számjegy. A backend bcrypt-eli. */
  pin?: string
  active?: boolean
}

/** Részleges update — minden mező opcionális, de `pin` csak akkor küldődik, ha cserélni akarjuk. */
export interface UserUpdateInput {
  name?: string
  email?: string
  role?: UserRole
  notes?: string
  pin?: string
  active?: boolean
}

export async function listUsers(): Promise<User[]> {
  const res = await safeFetch(url('/users'))
  return handleResponse<User[]>(res, 'Nem sikerült lekérni a felhasználókat')
}

export async function createUser(input: UserCreateInput): Promise<User> {
  const res = await safeFetch(url('/users'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return handleResponse<User>(res, 'Nem sikerült létrehozni a felhasználót')
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<User> {
  const res = await safeFetch(url(`/users/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return handleResponse<User>(res, 'Nem sikerült módosítani a felhasználót')
}

export async function deleteUser(id: string): Promise<void> {
  const res = await safeFetch(url(`/users/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  })
  if (res.status === 204) return
  // Ha hibát adott, dobunk
  await handleResponse<void>(res, 'Nem sikerült törölni a felhasználót')
}
