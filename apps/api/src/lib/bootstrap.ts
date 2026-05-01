/**
 * Bootstrap-műveletek alkalmazás-induláskor.
 *
 * Idempotens — minden indításkor lefut, de csak akkor csinál bármit, ha a
 * DB üres állapotban van. A cél: első indításkor legyen egy működő admin
 * user, amellyel be lehet lépni — egyébként az alkalmazás "kifagy" a Phase 3
 * auth-szigorítások miatt (a master-data routes admin-only).
 *
 * Konfiguráció (env):
 *  - DEFAULT_ADMIN_NAME (default: "Admin")
 *  - DEFAULT_ADMIN_PIN  (kötelező első indításkor; ha üres, csak figyelmeztetünk)
 *
 * Biztonsági megfontolás: a default PIN-t első bejelentkezés után
 * **mindenképpen** cseréltessük le (Phase 4 — kötelező első-belépés-kori
 * PIN-csere). Egyelőre csak warningot logolunk.
 */
import type { FastifyBaseLogger } from 'fastify'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/connection.js'
import { users } from '../db/schema.js'
import { hashPin } from './passwords.js'
import { config } from '../config.js'

/**
 * Ha még nincs `admin` szerepkörű, aktív user, létrehoz egyet a default
 * admin-credenciálokkal. Hibatűrő — minden hibát a logba ír, de nem
 * dobja tovább, hogy az alkalmazás akkor is induljon, ha pl. a DB
 * éppen migráció előtt van (a healthcheck majd jelez).
 */
export function bootstrapAdmin(log: FastifyBaseLogger): void {
  try {
    const db = getDb()
    const existingAdmins = db
      .select()
      .from(users)
      .where(eq(users.role, 'admin'))
      .all()

    if (existingAdmins.length > 0) {
      log.debug(
        { count: existingAdmins.length },
        '[bootstrap] már van admin a DB-ben — kihagyva'
      )
      return
    }

    const pin = config.defaultAdminPin
    if (!pin || pin.length === 0) {
      log.warn(
        '[bootstrap] nincs admin a DB-ben és DEFAULT_ADMIN_PIN sincs beállítva. ' +
          'Az admin-funkciók nem lesznek elérhetőek. ' +
          'Állítsd be a DEFAULT_ADMIN_PIN env-változót (4-8 számjegy), majd indítsd újra.'
      )
      return
    }
    if (!/^\d{4,8}$/.test(pin)) {
      log.error(
        { length: pin.length },
        '[bootstrap] DEFAULT_ADMIN_PIN érvénytelen — 4-8 számjegyűnek kell lennie. Az admin-bootstrap kihagyva.'
      )
      return
    }

    const now = new Date().toISOString()
    const id = uuidv4()
    db.insert(users)
      .values({
        id,
        name: config.defaultAdminName,
        email: '',
        role: 'admin',
        notes: 'Bootstrap admin — első bejelentkezés után cseréld a PIN-t!',
        pinHash: hashPin(pin),
        active: true,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run()

    log.info(
      { id, name: config.defaultAdminName },
      '[bootstrap] alapértelmezett admin felhasználó létrehozva. ' +
        'BIZTONSÁG: az első sikeres bejelentkezés után cseréld a PIN-t!'
    )
  } catch (err) {
    log.error({ err }, '[bootstrap] hiba az admin-felhasználó létrehozásakor — átugrom')
  }
}
