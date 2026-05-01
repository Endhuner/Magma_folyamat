/**
 * Központi konfig — egy helyen olvasunk env-et, és a többi modul innen
 * importál. Megkönnyíti a tesztelhetőséget (mockolhatjuk a configot, nem
 * a process.env-et) és segít megfogni a hiányzó változókat induláskor.
 */
import 'dotenv/config'
import path from 'node:path'
import { randomBytes } from 'node:crypto'

function requireEnv(key: string, fallback?: string): string {
  const v = process.env[key]
  if (v && v.length > 0) return v
  if (fallback !== undefined) return fallback
  throw new Error(`Hiányzó kötelező környezeti változó: ${key}`)
}

function parsePort(raw: string): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 65535) {
    throw new Error(`Érvénytelen PORT érték: ${raw}`)
  }
  return n
}

function parseOrigins(raw: string): string[] | true {
  const trimmed = raw.trim()
  if (trimmed === '*' || trimmed === 'true') return true
  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function parseBool(raw: string): boolean {
  return raw === 'true' || raw === '1' || raw === 'yes'
}

function parseTtl(raw: string): number {
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0 || n > 60 * 60 * 24 * 30) {
    throw new Error(`Érvénytelen SESSION_TTL_SECONDS: ${raw}`)
  }
  return n
}

/**
 * JWT secret. Ha nincs env-ben, futás-időben generálunk egyet — figyelmeztetést
 * írunk a logba, mert minden restart kijelentkezteti a felhasználókat.
 *
 * Production-ben (NODE_ENV=production) **kötelező** a JWT_SECRET, és legalább
 * 32 karakter. Ha hiányzik vagy túl rövid, az alkalmazás induláskor leáll —
 * jobb fail-fast, mint csendben kockázatos állapotban futni.
 */
function resolveJwtSecret(): string {
  const v = process.env.JWT_SECRET
  const isProd = process.env.NODE_ENV === 'production'

  if (v && v.length >= 32) return v

  if (isProd) {
    throw new Error(
      'JWT_SECRET hiányzik vagy túl rövid (<32 char). Production-ben kötelező. ' +
        'Generálj egyet: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    )
  }

  if (v && v.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('[config] JWT_SECRET túl rövid (<32 char), ephemeral kulcsra esem vissza (dev only)')
  }
  // Dev-only branch: ephemeral kulcs. A buildApp() runtime-figyelmeztetést is ad.
  return randomBytes(48).toString('hex')
}

export const config = {
  port: parsePort(requireEnv('PORT', '5050')),
  host: requireEnv('HOST', '0.0.0.0'),
  databaseFile: path.resolve(
    requireEnv('DATABASE_FILE', './data/produktivpro.sqlite')
  ),
  corsOrigin: parseOrigins(requireEnv('CORS_ORIGIN', '*')),
  logLevel: requireEnv('LOG_LEVEL', 'info'),
  defaultAuditUser: requireEnv('DEFAULT_AUDIT_USER', 'system'),

  // Phase 3 — auth
  jwtSecret: resolveJwtSecret(),
  jwtSecretFromEnv: Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32),
  sessionTtlSeconds: parseTtl(requireEnv('SESSION_TTL_SECONDS', '28800')),
  cookieSecure: parseBool(requireEnv('COOKIE_SECURE', 'false')),
  defaultAdminName: requireEnv('DEFAULT_ADMIN_NAME', 'Admin'),
  defaultAdminPin: process.env.DEFAULT_ADMIN_PIN || '',
} as const

export type AppConfig = typeof config
