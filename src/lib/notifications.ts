import type { Order, InventoryItem, ProductionKPIs, OrderStatus } from '@/lib/types'
import { isOverdue, isDelivered, formatDate } from '@/lib/helpers'

/**
 * Értesítési központ — tiszta, származtatott (derived) logika.
 *
 * Az értesítések a már meglévő, valós idejű állapotból SZÁMÍTÓDNAK
 * (rendelések, alacsony készlet, gyártási KPI) — nincs külön tárolásuk,
 * nincs backend. Minden értesítés determinisztikus, stabil ID-t kap, így az
 * „olvasott" állapot kulcsolható, és az értesítés magától eltűnik, ha a
 * kiváltó ok megszűnik (pl. feltöltött készlet, leszállított rendelés).
 */

export type NotificationSeverity = 'error' | 'warning' | 'info'

export type NotificationType = 'low-stock' | 'overdue' | 'due-soon' | 'defect-rate'

/** Hová ugorjon a felhasználó, ha az értesítésre kattint. */
export type NotificationTarget =
  | { kind: 'inventory' }
  | { kind: 'orders'; status?: OrderStatus | 'all' }
  | { kind: 'production' }

export interface AppNotification {
  /** Determinisztikus, stabil azonosító (pl. `overdue:<orderId>`). */
  id: string
  type: NotificationType
  severity: NotificationSeverity
  title: string
  message: string
  target: NotificationTarget
}

export interface NotificationSettings {
  /** Hány napon belüli határidőt tekintünk „közelgőnek". */
  dueSoonDays: number
  /** E fölött a heti selejt arány (%) riasztást ad. */
  defectThreshold: number
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  dueSoonDays: 3,
  defectThreshold: 5,
}

export interface DeriveNotificationsInput {
  orders: Order[]
  /** Már kiszámolt alacsony-készlet tételek (App.tsx lowStockItems). */
  lowStockItems: InventoryItem[]
  productionKPIs?: ProductionKPIs
  settings?: Partial<NotificationSettings>
  /** Tesztelhetőség miatt injektálható „most". */
  now?: Date
}

const SEVERITY_RANK: Record<NotificationSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Rendelés rövid, ember-olvasható címkéje. */
function orderLabel(order: Order): string {
  const name = order.productName || order.designation || 'Névtelen termék'
  return order.customer ? `${order.customer} — ${name}` : name
}

/**
 * A megadott állapotból leszármaztatja az aktuális értesítéseket,
 * súlyosság szerint rendezve (előbb a hibák, majd a figyelmeztetések).
 */
export function deriveNotifications(input: DeriveNotificationsInput): AppNotification[] {
  const settings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...input.settings,
  }
  const now = input.now ?? new Date()
  const today = startOfDay(now)

  const notifications: AppNotification[] = []
  const overdueOrderIds = new Set<string>()

  // 1) Alacsony készlet — egy értesítés tételenként.
  for (const item of input.lowStockItems) {
    notifications.push({
      id: `low-stock:${item.id}`,
      type: 'low-stock',
      severity: 'warning',
      title: 'Alacsony készlet',
      message: `${item.productName || 'Termék'} — ${item.quantity} db`,
      target: { kind: 'inventory' },
    })
  }

  // 2) Lejárt szállítási határidő — a meglévő isOverdue helperrel.
  for (const order of input.orders) {
    if (order.requiredDate && isOverdue(order.requiredDate, order.status)) {
      overdueOrderIds.add(order.id)
      notifications.push({
        id: `overdue:${order.id}`,
        type: 'overdue',
        severity: 'error',
        title: 'Lejárt határidő',
        message: `${orderLabel(order)} (határidő: ${formatDate(order.requiredDate)})`,
        target: { kind: 'orders', status: 'all' },
      })
    }
  }

  // 3) Közelgő határidő — nem leszállított, az elkövetkező N napon belül,
  //    de még nem lejárt (a lejártakat a 2) pont kezeli).
  for (const order of input.orders) {
    if (!order.requiredDate) continue
    if (isDelivered(order.status)) continue
    if (overdueOrderIds.has(order.id)) continue

    const due = startOfDay(new Date(order.requiredDate))
    if (Number.isNaN(due.getTime())) continue

    const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
    if (days < 0 || days > settings.dueSoonDays) continue

    const whenLabel = days === 0 ? 'ma' : days === 1 ? 'holnap' : `${days} nap múlva`
    notifications.push({
      id: `due-soon:${order.id}`,
      type: 'due-soon',
      severity: 'warning',
      title: 'Közelgő határidő',
      message: `${orderLabel(order)} (${whenLabel}, ${formatDate(order.requiredDate)})`,
      target: { kind: 'orders', status: 'all' },
    })
  }

  // 4) Magas selejt arány — heti KPI a küszöb fölött.
  if (input.productionKPIs && input.productionKPIs.defectRate > settings.defectThreshold) {
    notifications.push({
      id: 'defect-rate',
      type: 'defect-rate',
      severity: 'warning',
      title: 'Magas selejt arány',
      message: `Heti selejt arány: ${input.productionKPIs.defectRate}% (${input.productionKPIs.weekDefects} db)`,
      target: { kind: 'production' },
    })
  }

  // Súlyosság szerinti stabil rendezés (a Array.prototype.sort stabil).
  return notifications.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}
