import { useCallback, useMemo } from 'react'
import type { Order, InventoryItem, ProductionKPIs } from '@/lib/types'
import {
  deriveNotifications,
  DEFAULT_NOTIFICATION_SETTINGS,
  type AppNotification,
  type NotificationSettings,
} from '@/lib/notifications'
import { useAppSetting } from '@/hooks/useAppSetting'

export interface UseNotificationsArgs {
  orders: Order[]
  lowStockItems: InventoryItem[]
  productionKPIs?: ProductionKPIs
}

export interface UseNotifications {
  /** Aktuális értesítések, súlyosság szerint rendezve. */
  notifications: AppNotification[]
  /** Még nem olvasott értesítések száma. */
  unreadCount: number
  /** Igaz, ha az adott értesítés ID-je olvasottnak van jelölve. */
  isRead: (id: string) => boolean
  /** Minden aktuális értesítést olvasottnak jelöl. */
  markAllRead: () => void
}

/**
 * useNotifications — a `deriveNotifications` köré csomagolt React hook.
 *
 * A számított értesítéseket összeveti a perzisztált „olvasott" ID-listával
 * (`useAppSetting`), kiszámolja az olvasatlan-számlálót, és lehetőséget ad az
 * összes olvasottnak jelölésére. A read-listát az aktuális ID-kre takarítja,
 * hogy a megszűnt értesítések ne hízlalják korlátlanul.
 */
export function useNotifications({
  orders,
  lowStockItems,
  productionKPIs,
}: UseNotificationsArgs): UseNotifications {
  const [settings] = useAppSetting<NotificationSettings>(
    'notification-settings',
    DEFAULT_NOTIFICATION_SETTINGS
  )
  const [readIds, setReadIds] = useAppSetting<string[]>('notification-read-ids', [])

  const notifications = useMemo(
    () => deriveNotifications({ orders, lowStockItems, productionKPIs, settings }),
    [orders, lowStockItems, productionKPIs, settings]
  )

  const readSet = useMemo(() => new Set(readIds), [readIds])

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => (readSet.has(n.id) ? acc : acc + 1), 0),
    [notifications, readSet]
  )

  const isRead = useCallback((id: string) => readSet.has(id), [readSet])

  const markAllRead = useCallback(() => {
    // Csak a jelenleg létező értesítések ID-jét tartjuk meg → a read-lista
    // nem hízik a már megszűnt értesítésekkel.
    setReadIds(notifications.map((n) => n.id))
  }, [notifications, setReadIds])

  return { notifications, unreadCount, isRead, markAllRead }
}
