/**
 * AuditLogRepo — Változásnapló adathozzáférési réteg.
 *
 * Indexek: `entityType`, `entityId`, `action`, `createdAt`,
 * `[entityType+entityId]` (összetett — egy konkrét entitás összes
 * naplóbejegyzése időrendben kérhető).
 *
 * Megjegyzés: az audit-log gyorsan nőhet (sok ezer sor). A `listPaged()`
 * kurzor-alapú lapozást ad, ami nem hozza memóriába az egész táblát.
 */
import { liveQuery } from 'dexie'
import { getDb } from '../database'
import type {
  AuditLogEntry,
  AuditEntityType,
  AuditAction,
} from '@/lib/types'

export interface PagedAuditOpts {
  /** Lapméret (alapértelmezett: 50). */
  limit?: number
  /** Hány elemet ugorjunk át a kezdetétől. */
  offset?: number
  /** Csak ezen entitás-típushoz tartozó sorok. */
  entityType?: AuditEntityType
  /** Csak ezen művelet-típushoz tartozó sorok. */
  action?: AuditAction
}

export const auditLogRepo = {
  tableName: 'auditLog' as const,

  async list(): Promise<AuditLogEntry[]> {
    return getDb().auditLog.toArray()
  },

  async getById(id: string): Promise<AuditLogEntry | undefined> {
    return getDb().auditLog.get(id)
  },

  /**
   * Lapozott lekérés — a UI infinite-scroll vagy lapozó komponensének.
   * `createdAt` szerint csökkenő sorrendben (a legfrissebbek elöl).
   */
  async listPaged(opts: PagedAuditOpts = {}): Promise<AuditLogEntry[]> {
    const { limit = 50, offset = 0, entityType, action } = opts
    let coll = getDb().auditLog.orderBy('createdAt').reverse()

    if (entityType || action) {
      coll = coll.filter((entry) => {
        if (entityType && entry.entityType !== entityType) return false
        if (action && entry.action !== action) return false
        return true
      })
    }

    return coll.offset(offset).limit(limit).toArray()
  },

  /** Egy konkrét entitás teljes változástörténete — összetett index. */
  async byEntity(
    entityType: AuditEntityType,
    entityId: string
  ): Promise<AuditLogEntry[]> {
    const list = await getDb()
      .auditLog.where('[entityType+entityId]')
      .equals([entityType, entityId])
      .toArray()
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async byEntityType(entityType: AuditEntityType): Promise<AuditLogEntry[]> {
    return getDb().auditLog.where('entityType').equals(entityType).toArray()
  },

  async byAction(action: AuditAction): Promise<AuditLogEntry[]> {
    return getDb().auditLog.where('action').equals(action).toArray()
  },

  async save(entry: AuditLogEntry): Promise<string> {
    return getDb().auditLog.put(entry)
  },

  async saveMany(entries: AuditLogEntry[]): Promise<void> {
    await getDb().auditLog.bulkPut(entries)
  },

  async delete(id: string): Promise<void> {
    await getDb().auditLog.delete(id)
  },

  async deleteMany(ids: string[]): Promise<void> {
    await getDb().auditLog.bulkDelete(ids)
  },

  async count(): Promise<number> {
    return getDb().auditLog.count()
  },

  /**
   * Régi sorok törlése egy adott időpont előttről — pl. retention policy.
   * Megfontoltan használandó (irreverzibilis).
   */
  async pruneOlderThan(isoDate: string): Promise<number> {
    return getDb().auditLog.where('createdAt').below(isoDate).delete()
  },

  live() {
    return liveQuery(() => getDb().auditLog.orderBy('createdAt').reverse().toArray())
  },
}
