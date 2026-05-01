/**
 * drizzle-kit konfiguráció — a `npm run db:generate` használja a
 * migrációk generálásához. A futás-időbeli konfig a `src/config.ts`-ben él;
 * a CLI csak a `dbCredentials` és `dialect` mezőket nézi.
 */
import 'dotenv/config'
import path from 'node:path'
import type { Config } from 'drizzle-kit'

const dbFile = path.resolve(
  process.env.DATABASE_FILE || './data/produktivpro.sqlite'
)

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: dbFile,
  },
  strict: true,
  verbose: true,
} satisfies Config
