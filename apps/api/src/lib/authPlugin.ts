/**
 * @fastify/jwt + @fastify/cookie plugin-regisztráció.
 *
 * A JWT-t httpOnly + SameSite=Lax cookie-ban tartjuk. Ez véd a CSRF + XSS
 * támadások egy részétől — a nyitott CORS-szal együtt a frontend csak
 * `credentials: 'include'`-szel tudja használni.
 *
 * Token-life:
 *  - exp: now + sessionTtlSeconds (config-ból, default 8 óra)
 *  - payload: { sub: userId, name, role }
 *
 * A `request.user` típusát a `@fastify/jwt` augmentálja.
 */
import type { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import { config } from '../config.js'
import type { CurrentUser } from '@produktivpro/shared'

export const COOKIE_NAME = 'pp_session'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; name: string; role: CurrentUser['role'] }
    user: CurrentUser
  }
}

export async function registerAuthPlugins(app: FastifyInstance): Promise<void> {
  await app.register(cookie, {
    secret: config.jwtSecret, // signált cookie-khoz; mi maga a JWT, így csak a tárhoz kell
    parseOptions: {},
  })

  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: {
      cookieName: COOKIE_NAME,
      signed: false,
    },
    sign: { expiresIn: config.sessionTtlSeconds },
    // A formatUser a payload-ból csinál request.user-t.
    formatUser: (payload) => ({
      id: payload.sub,
      name: payload.name,
      role: payload.role,
    }),
  })

  if (!config.jwtSecretFromEnv) {
    app.log.warn(
      'JWT_SECRET nincs env-ben (vagy < 32 karakter) — ephemeral kulcsra estem vissza. ' +
        'Production-ben állítsd be! Generálj egyet: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    )
  }
}
