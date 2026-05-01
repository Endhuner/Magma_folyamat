/**
 * Request-logger middleware.
 *
 * Az audit-log üzleti szintű (entitás-szinten követi a változásokat).
 * A request-log technikai szintű — minden HTTP kérést egy soros pino-log-ba
 * írunk: method + url + status + duration. Hibák diagnosztikájához hasznos,
 * és a Docker stdout-jából a binhex-nginx melletti log-szállító (loki / file)
 * is be tudja gyűjteni.
 *
 * Nem írunk a DB-be — ez nem audit, hanem operational log.
 */
import type { FastifyInstance } from 'fastify'

export function registerRequestLogger(app: FastifyInstance): void {
  app.addHook('onRequest', async (req) => {
    // Mérési kezdőidő — onResponse hookban olvassuk vissza.
    ;(req as unknown as { _t0: bigint })._t0 = process.hrtime.bigint()
  })

  app.addHook('onResponse', async (req, reply) => {
    const t0 = (req as unknown as { _t0?: bigint })._t0
    const durMs = t0 ? Number(process.hrtime.bigint() - t0) / 1_000_000 : -1
    const log = req.log
    const fields = {
      method: req.method,
      url: req.url,
      status: reply.statusCode,
      durationMs: Math.round(durMs * 100) / 100,
      ip: req.ip,
    }
    // 4xx → warn, 5xx → error, egyebek info
    if (reply.statusCode >= 500) log.error(fields, 'request')
    else if (reply.statusCode >= 400) log.warn(fields, 'request')
    else log.info(fields, 'request')
  })
}
