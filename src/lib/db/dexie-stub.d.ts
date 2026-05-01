/**
 * Helyi típus-stub a Dexie-hez — KIZÁRÓLAG akkor aktív, amikor a
 * `dexie` még nincs telepítve (pl. Sandbox/CI registry-blokk).
 *
 * Mihelyt `npm install dexie` lefutott, a `node_modules/dexie/dist/dexie.d.ts`
 * felülbírálja ezt a stubot (TypeScript a leggyakoribb feloldási útvonalat
 * használja).
 *
 * Ne adj hozzá nem használt API-felületeket — minimálisan tartjuk,
 * hogy a valódi típusok ne ütközzenek.
 */
declare module 'dexie' {
  export type IndexableType = string | number | Date | ArrayBuffer | (string | number)[]

  export interface Collection<T = unknown, _Key = string> {
    toArray(): Promise<T[]>
    count(): Promise<number>
    first(): Promise<T | undefined>
    last(): Promise<T | undefined>
    each(callback: (item: T) => void): Promise<void>
    sortBy(key: string): Promise<T[]>
    reverse(): Collection<T, _Key>
    limit(n: number): Collection<T, _Key>
    offset(n: number): Collection<T, _Key>
    filter(fn: (item: T) => boolean): Collection<T, _Key>
    delete(): Promise<number>
    modify(changes: Partial<T> | ((item: T) => void)): Promise<number>
  }

  export interface WhereClause<T = unknown, Key = string> {
    equals(value: IndexableType): Collection<T, Key>
    above(value: IndexableType): Collection<T, Key>
    below(value: IndexableType): Collection<T, Key>
    between(low: IndexableType, high: IndexableType): Collection<T, Key>
    startsWith(value: string): Collection<T, Key>
    anyOf(...values: IndexableType[]): Collection<T, Key>
  }

  export interface Table<T = unknown, Key = string> {
    name: string
    add(item: T, key?: Key): Promise<Key>
    put(item: T, key?: Key): Promise<Key>
    bulkPut(items: T[]): Promise<Key>
    bulkAdd(items: T[]): Promise<Key>
    get(key: Key): Promise<T | undefined>
    delete(key: Key): Promise<void>
    bulkDelete(keys: Key[]): Promise<void>
    clear(): Promise<void>
    count(): Promise<number>
    toArray(): Promise<T[]>
    toCollection(): Collection<T, Key>
    where(field: string | string[]): WhereClause<T, Key>
    orderBy(field: string): Collection<T, Key>
    each(callback: (item: T) => void): Promise<void>
    update(key: Key, changes: Partial<T>): Promise<number>
  }

  export interface Transaction {
    abort(): void
  }

  export type TransactionMode = 'r' | 'rw' | 'r!' | 'rw!' | 'r?' | 'rw?'

  export default class Dexie {
    constructor(databaseName: string)
    name: string
    version(versionNumber: number): {
      stores(schema: Record<string, string | null>): {
        upgrade(callback: (tx: Transaction) => void | Promise<void>): unknown
      }
    }
    open(): Promise<Dexie>
    close(): void
    delete(): Promise<void>
    table<T = unknown, Key = string>(name: string): Table<T, Key>
    transaction(
      mode: TransactionMode,
      tables: Table<unknown, string>[] | string[],
      fn: (tx: Transaction) => Promise<void> | void
    ): Promise<void>
  }

  /**
   * Live query — observable, ami minden adatváltozásnál újraértékeli a callbacket.
   * A valódi Dexie-ben generikus, itt minimalizálva.
   */
  export function liveQuery<T>(
    querier: () => T | Promise<T>
  ): {
    subscribe(observer: {
      next?: (value: T) => void
      error?: (err: unknown) => void
      complete?: () => void
    }): { unsubscribe(): void }
  }
}
