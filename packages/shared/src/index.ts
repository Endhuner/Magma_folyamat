/**
 * `@produktivpro/shared` – közös típusok és sémák a frontend (React app a root-ban)
 * és a backend (`apps/api`) között.
 *
 * Egyelőre csak a domain-típusokat tartalmazza. A jövőben ide kerülnek a
 * Zod-sémák (input-validáció, drizzle-zod-ből generálva) és a közös enumok
 * is, hogy mindkét oldal egyetlen forrásból dolgozzon.
 *
 * Megj.: a frontend még a saját `src/lib/types.ts`-ét használja, hogy a
 * Phase 1 átállás minimál legyen. Phase 2-ben (DB-integráció) a frontend
 * is erre a csomagra fog hivatkozni, és a `src/lib/types.ts` re-exporttá
 * vékonyodik, mielőtt teljesen eltűnik.
 */
export * from './types.js'
export * from './schemas.js'
