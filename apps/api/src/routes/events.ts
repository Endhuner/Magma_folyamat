/**
 * Server-Sent Events endpoint a kliens-oldali real-time frissítéshez.
 *
 * GET /api/v1/events
 *
 * A frontend `EventSource('/api/v1/events')`-szel tud feliratkozni. Minden
 * mutáció után (CRUD-factory, audit-service) egy `event` esemény érkezik
 * a `BroadcastEvent` JSON-tartalommal.
 *
 * Megj.: SSE-hez hosszú futású válasz kell, ezért a Fastify default
 * `connectionTimeout`-ját 0-ra (== nincs limit) állítjuk a route-on belül a
 * `reply.raw` socket szintjén. A keep-alive `\n` 25 másodpercenként megy
 * ki, hogy az nginx ne dobja le a kapcsolatot a default 60s timeout miatt.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { subscribe, type BroadcastEvent } from '../lib/sseBroadcaster.js'

const KEEPALIVE_INTERVAL_MS = 25_000

export async function eventsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/events', async (req: FastifyRequest, reply: FastifyReply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      // Az nginx ne pufferelje az SSE-t — különben az események csak akkor
      // mennek ki, ha a buffer megtelik vagy a kapcsolat zárul.
      'X-Accel-Buffering': 'no',
    })

    // Üdvözlő üzenet — a kliens tudja, hogy a kapcsolat él.
    reply.raw.write(`: connected at ${new Date().toISOString()}\n\n`)

    const send = (event: BroadcastEvent) => {
      reply.raw.write(`event: ${event.type}\n`)
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    const unsubscribe = subscribe(send)

    // Keep-alive — komment-sor ('\n: ping\n\n'). Az nginx és proxy-k
    // többségének ennyi elég, hogy a kapcsolatot életben tartsa.
    const keepalive = setInterval(() => {
      try {
        reply.raw.write(`: ping ${Date.now()}\n\n`)
      } catch {
        // ha a write már nem megy, a 'close' eseményt már megkaptuk vagy
        // mindjárt megkapjuk — a cleanup ott megtörténik
      }
    }, KEEPALIVE_INTERVAL_MS)

    req.raw.on('close', () => {
      clearInterval(keepalive)
      unsubscribe()
    })

    // Hagyjuk a kapcsolatot nyitva — Fastify a return-en lezárná.
    return reply
  })
}
