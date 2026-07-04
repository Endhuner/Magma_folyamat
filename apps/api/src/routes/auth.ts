/**
 * Authentikáció route-ok:
 *   POST /api/v1/auth/login       — userId + PIN → cookie-ban JWT
 *   POST /api/v1/auth/logout      — cookie törlés
 *   GET  /api/v1/auth/me          — current user (publikus alak)
 *   GET  /api/v1/auth/users-public — bejelentkezhető userek listája (id + name)
 *
 * A `users-public` *autentikáció nélkül* hívható — a login képernyőnek tudnia
 * kell, hogy ki vehet részt. Csak `id` + `name` + `role` megy ki, semmi PIN
 * vagy email.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { eq } from 'drizzle-orm'
import { loginInputSchema } from '@produktivpro/shared'
import { getDb } from '../db/connection.js'
import { users } from '../db/schema.js'
import { verifyPin } from '../lib/passwords.js'
import { COOKIE_NAME } from '../lib/authPlugin.js'
import { config } from '../config.js'

interface LoginBody {
  userId: string
  pin: string
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: config.sessionTtlSeconds,
}

/**
 * PIN brute-force védelem: IP-nként számoljuk a hibás próbálkozásokat.
 * 5 hibás próba után 60 mp zárolás. Sikeres belépés nullázza a számlálót.
 * ponytail: in-memory (restartkor ürül) — több API-példány esetén Redis-alapú
 * megoldásra kell váltani.
 */
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 60_000
const failedLogins = new Map<string, { count: number; lockedUntil: number }>()

function loginLocked(key: string): boolean {
  const entry = failedLogins.get(key)
  if (!entry) return false
  if (entry.lockedUntil > Date.now()) return true
  if (entry.lockedUntil > 0) failedLogins.delete(key) // zárolás lejárt
  return false
}

function recordLoginFailure(key: string): void {
  const entry = failedLogins.get(key) ?? { count: 0, lockedUntil: 0 }
  entry.count += 1
  if (entry.count >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS
    entry.count = 0
  }
  failedLogins.set(key, entry)
  // Ne nőjön korlátlanul: régi bejegyzések takarítása
  if (failedLogins.size > 10_000) failedLogins.clear()
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // ---------- LOGIN ----------
  app.post('/auth/login', async (req: FastifyRequest<{ Body: LoginBody }>, reply: FastifyReply) => {
    const parsed = loginInputSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Érvénytelen bejelentkezési adatok',
        issues: parsed.error.issues,
      })
    }
    const { userId, pin } = parsed.data

    if (loginLocked(req.ip)) {
      app.log.warn({ userId, ip: req.ip }, 'login locked (brute-force védelem)')
      return reply.code(429).send({
        error: 'Túl sok hibás próbálkozás — várj egy percet, majd próbáld újra',
      })
    }

    const db = getDb()
    const rows = db.select().from(users).where(eq(users.id, userId)).all()
    const user = rows[0]
    // Konstans-idejű válasz: ha nincs user is futtatunk egy bcrypt-ellenőrzést
    // egy dummy hash-en, hogy ne lehessen időzítés alapján megállapítani.
    const ok = user
      ? user.active && verifyPin(pin, user.pinHash)
      : (verifyPin(pin, '$2a$10$abcdefghijklmnopqrstuv'), false)

    if (!ok || !user) {
      recordLoginFailure(req.ip)
      app.log.warn({ userId, ip: req.ip }, 'login fail')
      return reply.code(401).send({ error: 'Hibás felhasználó vagy PIN' })
    }

    failedLogins.delete(req.ip)

    db.update(users)
      .set({ lastLoginAt: new Date().toISOString() })
      .where(eq(users.id, user.id))
      .run()

    const token = await reply.jwtSign(
      { sub: user.id, name: user.name, role: user.role },
      { expiresIn: config.sessionTtlSeconds }
    )

    reply.setCookie(COOKIE_NAME, token, COOKIE_OPTIONS)

    return {
      id: user.id,
      name: user.name,
      role: user.role,
    }
  })

  // ---------- LOGOUT ----------
  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return { ok: true }
  })

  // ---------- ME ----------
  app.get('/auth/me', async (req, reply) => {
    if (config.disableAuth) {
      return { sub: 'dev-admin', name: 'Dev Admin', role: 'admin' }
    }
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Nincs bejelentkezve' })
    }
    return req.user
  })

  // ---------- PUBLIC USER LIST (login-screenhez) ----------
  app.get('/auth/users-public', async () => {
    const db = getDb()
    const rows = db.select().from(users).where(eq(users.active, true)).all()
    return rows.map((u) => ({ id: u.id, name: u.name, role: u.role }))
  })
}
