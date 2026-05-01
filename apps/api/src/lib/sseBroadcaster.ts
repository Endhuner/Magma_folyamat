/**
 * Egyszerű SSE-broadcaster. EventEmitter alapú, minden SSE-kapcsolat egy
 * listener. A `broadcast()` függvény bárhonnan hívható mutáció után —
 * pl. a CRUD-factory minden POST/PUT/DELETE után meghívja.
 *
 * A `/events` endpoint (ld. routes/events.ts) feliratkozik az emitterre
 * és `text/event-stream` válaszként továbbítja az üzeneteket.
 *
 * Üzenet-formátum:
 *   { type: AuditEntityType, action: 'create'|'update'|'delete', id: string, ts: string }
 *
 * A frontend (Phase 2) a saját kvStore-jának SSE-megfelelőjét tudja erre
 * építeni, és invalidálni a megfelelő React Query cache-t.
 */
import { EventEmitter } from 'node:events'
import type { AuditEntityType } from '@produktivpro/shared'

export interface BroadcastEvent {
  type: AuditEntityType | 'auditLog'
  action: 'create' | 'update' | 'delete' | 'in' | 'out' | 'adjustment' | 'status'
  id: string
  ts: string
}

const emitter = new EventEmitter()
// A Fastify request-life-cycle alatt sok SSE-kapcsolat lehet egy időben.
// A default 10-es limit gyorsan elfogyna.
emitter.setMaxListeners(0)

export function broadcast(
  partial: Omit<BroadcastEvent, 'ts'>
): void {
  const event: BroadcastEvent = { ...partial, ts: new Date().toISOString() }
  emitter.emit('event', event)
}

export function subscribe(listener: (event: BroadcastEvent) => void): () => void {
  emitter.on('event', listener)
  return () => emitter.off('event', listener)
}
