/**
 * Lomtár-szolgáltatás (soft delete).
 *
 * A CRUD-factory törlés előtt ide menti a rekord teljes payloadját. A törölt
 * tétel 30 napig visszaállítható az eredeti táblába. A visszaállításhoz
 * entity-típusonként ismernünk kell a cél-táblát — ezt a `registerTrashable`
 * regisztrálja (a crudFactory hívja minden resource-nál).
 */
import { eq, lt, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { getDb } from '../db/connection.js'
import { trash } from '../db/schema.js'

interface Trashable {
  table: SQLiteTable
  label: string
}

// entityType → cél-tábla + felirat
const registry = new Map<string, Trashable>()

export function registerTrashable(entityType: string, table: SQLiteTable, label: string): void {
  registry.set(entityType, { table, label })
}

/**
 * Törölt rekord elhelyezése a lomtárban.
 * @param row a DB-ből olvasott rekord (a JSON-mezők már szerializált stringek)
 */
export function moveToTrash(params: {
  entityType: string
  entityId: string
  entityLabel: string
  entityName: string
  row: Record<string, unknown>
  deletedBy?: string
  deletedByName?: string
}): void {
  const db = getDb()
  db.insert(trash).values({
    id: uuidv4(),
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    entityName: params.entityName,
    payload: JSON.stringify(params.row),
    deletedBy: params.deletedBy ?? '',
    deletedByName: params.deletedByName ?? '',
    deletedAt: new Date().toISOString(),
  }).run()
}

export interface TrashRow {
  id: string
  entityType: string
  entityId: string
  entityLabel: string
  entityName: string
  deletedBy: string
  deletedByName: string
  deletedAt: string
}

/** Lomtár listája (payload nélkül — a lista könnyű maradjon). */
export function listTrash(): TrashRow[] {
  const db = getDb()
  const rows = db
    .select({
      id: trash.id,
      entityType: trash.entityType,
      entityId: trash.entityId,
      entityLabel: trash.entityLabel,
      entityName: trash.entityName,
      deletedBy: trash.deletedBy,
      deletedByName: trash.deletedByName,
      deletedAt: trash.deletedAt,
    })
    .from(trash)
    .orderBy(desc(trash.deletedAt))
    .all()
  return rows as TrashRow[]
}

export type RestoreResult =
  | { ok: true; entityType: string; entityId: string }
  | { ok: false; reason: 'not-found' | 'unknown-type' | 'conflict' }

/**
 * Visszaállítja a lomtár tételét az eredeti táblába, majd törli a lomtárból.
 * Ha az eredeti id már létezik (időközben újra létrehozták), 'conflict'.
 */
export function restoreFromTrash(trashId: string): RestoreResult {
  const db = getDb()
  const entry = db.select().from(trash).where(eq(trash.id, trashId)).get()
  if (!entry) return { ok: false, reason: 'not-found' }

  const target = registry.get(entry.entityType)
  if (!target) return { ok: false, reason: 'unknown-type' }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(entry.payload)
  } catch {
    return { ok: false, reason: 'not-found' }
  }

  const idCol = (target.table as unknown as { id: { name: string } }).id
  const existing = db.select().from(target.table).where(eq(idCol as never, entry.entityId)).get()
  if (existing) return { ok: false, reason: 'conflict' }

  db.transaction((tx) => {
    tx.insert(target.table).values(payload as never).run()
    tx.delete(trash).where(eq(trash.id, trashId)).run()
  })
  return { ok: true, entityType: entry.entityType, entityId: entry.entityId }
}

/** Egy lomtár-tétel végleges törlése. */
export function purgeTrashItem(trashId: string): boolean {
  const db = getDb()
  const res = db.delete(trash).where(eq(trash.id, trashId)).run()
  return res.changes > 0
}

/** A megőrzési időn túli tételek végleges törlése (alap: 30 nap). */
export function purgeExpiredTrash(retentionDays = 30): number {
  const db = getDb()
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()
  const res = db.delete(trash).where(lt(trash.deletedAt, cutoff)).run()
  return res.changes
}
