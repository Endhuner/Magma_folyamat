/**
 * ProduktívPro API — Fastify belépési pont.
 *
 * A teljes route-regisztráció a `buildApp` függvényben történik, hogy a
 * teszt is el tudja indítani egy tetszőleges porton.
 *
 * Ha a STATIC_DIR környezeti változó be van állítva (pl. Docker image-ben),
 * a szerver a React SPA statikus fájljait is kiszolgálja ugyanezen a porton —
 * nincs szükség külön nginx-re.
 */
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { config } from './config.js'
import { ordersRoutes } from './routes/orders.js'
import { customersRoutes } from './routes/customers.js'
import { productsRoutes } from './routes/products.js'
import { inventoryRoutes } from './routes/inventory.js'
import { productionRoutes } from './routes/production.js'
import { deliveryRoutes } from './routes/delivery.js'
import { masterDataRoutes } from './routes/masterData.js'
import { quotesRoutes } from './routes/quotes.js'
import { priceListsRoutes } from './routes/priceLists.js'
import { attendanceRoutes } from './routes/attendance.js'
import { datasheetsRoutes } from './routes/datasheets.js'
import { filledFormsRoutes } from './routes/filledForms.js'
import { toolsRoutes } from './routes/tools.js'
import { auditLogRoutes } from './routes/auditLog.js'
import { eventsRoutes } from './routes/events.js'
import { authRoutes } from './routes/auth.js'
import { backupRoutes } from './routes/backup.js'
import { settingsRoutes } from './routes/settings.js'
import { customerSequencesRoutes } from './routes/customerSequences.js'
import { templatesRoutes } from './routes/templates.js'
import { planningRoutes } from './routes/planning.js'
import { pdfRoutes } from './routes/pdf.js'
import { trashRoutes } from './routes/trash.js'
import { maintenanceRoutes } from './routes/maintenance.js'
import { messagesRoutes } from './routes/messages.js'
import { registerRequestLogger } from './lib/requestLogger.js'
import { registerAuthPlugins } from './lib/authPlugin.js'
import { bootstrapAdmin } from './lib/bootstrap.js'
import { startScheduledBackups } from './lib/scheduledBackup.js'
import { startMaterialConsolidation } from './lib/materialConsolidation.js'

/**
 * Csak akkor használjuk a `pino-pretty` transportot, ha a csomag valóban
 * fel van telepítve. Ha hiányzik (pl. friss `npm install` előtt vagy
 * production deps-only build), nyersen JSON-ban logolunk, de a szerver
 * elindul — a hiányzó dev-tooling NE törje fel az indulást.
 */
import { createRequire } from 'node:module'
function resolvePinoPrettyTransport():
  | { target: string; options: Record<string, unknown> }
  | undefined {
  if (process.env.NODE_ENV === 'production') return undefined
  try {
    const req = createRequire(import.meta.url)
    req.resolve('pino-pretty')
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
    }
  } catch {
    // eslint-disable-next-line no-console
    console.warn('[server] pino-pretty nincs telepítve — JSON-ben logolok. (npm install --save-dev pino-pretty)')
    return undefined
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Pretty stdout dev alatt; prod-ban JSON-ba megy a stdout-ra,
      // amit a docker-compose log-driver / Unraid log-szállítója visz tovább.
      transport: resolvePinoPrettyTransport(),
    },
    // Trust proxy: a binhex-nginx revproxy mögé tesszük, így a kliens IP-t
    // az X-Forwarded-For-ból olvassuk. Egy szint a default ('1' = 1 hop).
    trustProxy: true,
    // 5 MB body-limit — Excel-importok és DeliveryNote-export adatok bőven
    // beleférnek, de egy gonosz kliens nem tud OOM-mal meglökni egyetlen
    // request-tel. Felülbírálható env-ből (MAX_BODY_BYTES).
    bodyLimit:
      Number.parseInt(process.env.MAX_BODY_BYTES || '', 10) || 5 * 1024 * 1024,
    // 60 mp connection-timeout — szakadt kapcsolatokat időben lezárunk.
    // Az SSE keepalive (25s) ettől tovább él, mert ez csak idle-időt mér.
    connectionTimeout: 60_000,
  })

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  })
  await app.register(sensible)
  await registerAuthPlugins(app)
  registerRequestLogger(app)

  // Bootstrap admin user (idempotens — csak ha nincs admin a DB-ben)
  bootstrapAdmin(app.log)

  // Ütemezett automatikus adatbázis-mentés (naponta, 30 napos megőrzés)
  startScheduledBackups(app.log)

  // Napi anyagfogyás-könyvelés (A3 hibrid modell — ld. materialConsolidation)
  startMaterialConsolidation(app.log)

  // ── Statikus frontend kiszolgálása (Docker all-in-one mód) ─────────────
  // Ha a STATIC_DIR env be van állítva, a Fastify kiszolgálja a React SPA-t.
  // Fejlesztéskor ez nincs beállítva — a Vite dev server kezeli a frontendet.
  const staticDir = process.env.STATIC_DIR
  if (staticDir) {
    const resolvedStaticDir = path.resolve(staticDir)
    await app.register(fastifyStatic, {
      root: resolvedStaticDir,
      wildcard: false,    // ne fogja el az API útvonalakat
      index: false,       // az index.html-t mi szolgáljuk ki a 404-kezelőben
      prefix: '/',
    })
    app.log.info(`Statikus fájlok kiszolgálva: ${resolvedStaticDir}`)
  }

  // Egészségvizsgálat — Docker healthcheck
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: 'produktivpro-api',
      version: '0.1.0',
      time: new Date().toISOString(),
    }
  })

  // REST: entitások + auth egy közös /api/v1 prefix alatt
  await app.register(async (api) => {
    await api.register(authRoutes)
    await api.register(ordersRoutes)
    await api.register(customersRoutes)
    await api.register(productsRoutes)
    await api.register(inventoryRoutes)
    await api.register(productionRoutes)
    await api.register(deliveryRoutes)
    await api.register(masterDataRoutes)
    await api.register(quotesRoutes)
    await api.register(priceListsRoutes)
    await api.register(attendanceRoutes)
    await api.register(datasheetsRoutes)
    await api.register(filledFormsRoutes)
    await api.register(toolsRoutes)
    await api.register(auditLogRoutes)
    await api.register(eventsRoutes)
    await api.register(backupRoutes)
    await api.register(settingsRoutes)
    await api.register(customerSequencesRoutes)
    await api.register(templatesRoutes)
    await api.register(planningRoutes)
    await api.register(pdfRoutes)
    await api.register(trashRoutes)
    await api.register(maintenanceRoutes)
    await api.register(messagesRoutes)
  }, { prefix: '/api/v1' })

  // 404-kezelő:
  //   - /api/* útvonalak → JSON hibaüzenet
  //   - minden más → SPA index.html (React Router kezeli a kliens oldalon)
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Az erőforrás nem található: ${req.method} ${req.url}`,
      })
    }
    // SPA fallback: React Router kliens oldali routing-hoz
    if (staticDir) {
      return reply.sendFile('index.html', path.resolve(staticDir))
    }
    return reply.code(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' })
  })

  return app
}

async function start(): Promise<void> {
  const app = await buildApp()
  try {
    await app.listen({ port: config.port, host: config.host })
    app.log.info(
      `ProduktívPro API elindult: http://${config.host}:${config.port}`
    )
  } catch (err) {
    app.log.error(err, 'Indítási hiba — kilépés')
    process.exit(1)
  }
}

// CommonJS-mentes ESM "vagyok-e a fő modul" trükk — pontosabb, mint a
// require.main, mert ESM-ben nincs require.main.
// pathToFileURL használata szükséges, mert a könyvtárnévben szóköz esetén
// az import.meta.url URL-enkódolt (%20), míg a process.argv[1] nem.
import { pathToFileURL } from 'node:url'
const isEntry =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isEntry) {
  start().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Fatal:', err)
    process.exit(1)
  })
}
