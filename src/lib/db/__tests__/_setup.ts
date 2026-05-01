/**
 * Repo-tesztek setup — fake-indexeddb behúzása (ha elérhető).
 *
 * A `fake-indexeddb/auto` egy mellékhatás-import, ami a global
 * `indexedDB`-t és `IDBKeyRange`-t a fake implementációval helyettesíti.
 * Ha valamiért nem elérhető (pl. CI még nem futtatott `npm install`-t),
 * a tesztek `describe.skipIf(!globalThis.indexedDB)` ágon átugranak.
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fake-indexeddb/auto')
} catch {
  // fake-indexeddb nincs telepítve — a teszt meg fogja állapítani és skipeli.
}

export const idbAvailable =
  typeof globalThis !== 'undefined' &&
  typeof (globalThis as { indexedDB?: unknown }).indexedDB !== 'undefined'
