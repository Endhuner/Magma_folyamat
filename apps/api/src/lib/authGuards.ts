/**
 * Auth-guard middleware-ek a Fastify route-okhoz.
 *
 * Használat:
 *   app.get('/secret', { preHandler: requireAuth }, handler)
 *   app.delete('/orders/:id', { preHandler: requireRole('admin') }, handler)
 *
 * A `requireAuth` ellenőrzi, hogy van-e érvényes JWT-cookie.
 * A `requireRole(...roles)` ezen felül role-egyezést is megkövetel.
 *
 * **Soft auth** mód: a `tryAuth` opcionális — ha van token, beolvassa
 * a `request.user`-t, de ha nincs, csendben fut tovább. A CRUD-factory
 * ezt használja, hogy a userId/userName az audit-logba kerülhessen,
 * de a Phase 3 elindításakor ne dobjon ki mindenkit, akinek még nincs
 * cookie-ja (gradual rollout — ld. ROLLOUT_REQUIRES_AUTH config-flag).
 */
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import type { UserRole } from '@produktivpro/shared'

export const requireAuth: preHandlerHookHandler = async (req, reply) => {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Bejelentkezés szükséges' })
  }
}

export function requireRole(...allowed: UserRole[]): preHandlerHookHandler {
  return async (req, reply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Bejelentkezés szükséges' })
    }
    const role = req.user?.role
    if (!role || !allowed.includes(role)) {
      return reply.code(403).send({
        error: 'Nincs jogosultságod ehhez a művelethez',
        required: allowed,
        actual: role,
      })
    }
    return
  }
}

/**
 * Soft auth — a `request.user` beolvasása, ha van. Hiba esetén csendben
 * tovább. A CRUD-factory használja az audit-userId-hez.
 */
export const tryAuth: preHandlerHookHandler = async (req: FastifyRequest, _reply: FastifyReply) => {
  try {
    await req.jwtVerify()
  } catch {
    // ignore — req.user marad undefined
  }
}
