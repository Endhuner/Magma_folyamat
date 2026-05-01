/**
 * PIN-hash segédek bcrypt-tel.
 *
 * - 4–8 számjegyű PIN-eket használunk → kicsi entrópia, ezért **fontos** a
 *   bcrypt magas cost-faktora (10) + a brute-force ellen middleware-szintű
 *   rate-limit Phase 4-ben.
 * - Sose tároljuk a clear-text PIN-t. A `hashPin` szinkron, mert a Fastify
 *   route is szinkron logikát követ better-sqlite3 felett, és egy bcrypt-hash
 *   ~50–100ms — ez egy logini kérésnél nem kritikus.
 *
 * A `bcryptjs` (tiszta JS, nincs natív build) kicsit lassabb mint a `bcrypt`,
 * de Docker image-ben nem kell extra natív kompileri-deps — a tradeoff jó.
 */
import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

export function hashPin(pin: string): string {
  return bcrypt.hashSync(pin, SALT_ROUNDS)
}

export function verifyPin(pin: string, hash: string | null | undefined): boolean {
  if (!hash) return false
  try {
    return bcrypt.compareSync(pin, hash)
  } catch {
    return false
  }
}
