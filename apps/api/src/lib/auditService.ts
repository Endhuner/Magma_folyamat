/**
 * Audit-log író szolgáltatás.
 *
 * A frontend Phase 0-ban implementálta a mező-szintű diffet és a 10 000
 * bejegyzéses prune-t. A backend MOSTANTÓL kezdve birtokolja az audit-logot —
 * a frontend csak olvassa (Phase 2-ben).
 *
 * A `recordAudit` szinkron — better-sqlite3 amúgy is szinkron, és így a
 * mutáció + audit-log atomikusan ugyanabban az event-loop tickben fut.
 */
import { v4 as uuidv4 } from 'uuid'
import type { AuditAction, AuditEntityType, AuditFieldChange } from '@produktivpro/shared'
import { getDb } from '../db/connection.js'
import { auditLog } from '../db/schema.js'
import { config } from '../config.js'
import { broadcast } from './sseBroadcaster.js'

export interface RecordAuditInput {
  entityType: AuditEntityType
  entityLabel: string
  entityId: string
  entityName: string
  action: AuditAction
  changes?: AuditFieldChange[]
  notes?: string
  userId?: string
  userName?: string
}

export function recordAudit(input: RecordAuditInput): void {
  // Update művelet → ha nincs tényleges mező-eltérés, ne logoljunk semmit.
  // Ez konzisztens a frontend Phase 0 viselkedésével (csak valódi változás).
  if (input.action === 'update' && (!input.changes || input.changes.length === 0)) {
    return
  }

  const db = getDb()
  const id = uuidv4()
  db.insert(auditLog)
    .values({
      id,
      entityType: input.entityType,
      entityLabel: input.entityLabel,
      entityId: input.entityId,
      entityName: input.entityName,
      action: input.action,
      changes: input.changes && input.changes.length > 0 ? JSON.stringify(input.changes) : null,
      notes: input.notes || null,
      userId: input.userId || null,
      userName: input.userName || config.defaultAuditUser,
    })
    .run()

  // Az audit-log saját SSE-eseményt is generál — a frontend Activity Log
  // panelje így real-time frissül több gépnél is.
  broadcast({ type: 'auditLog', action: 'create', id })
}
