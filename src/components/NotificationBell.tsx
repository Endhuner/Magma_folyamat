import { useState } from 'react'
import { Bell, Warning, Package, Factory, CheckCircle } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { AppNotification, NotificationTarget, NotificationType } from '@/lib/notifications'
import type { UseNotifications } from '@/hooks/useNotifications'

interface NotificationBellProps extends UseNotifications {
  /** Kattintás egy értesítésre → a megfelelő nézetre ugrik. */
  onNavigate: (target: NotificationTarget) => void
}

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  'low-stock': Package,
  overdue: Warning,
  'due-soon': Warning,
  'defect-rate': Factory,
}

/** Súlyosság → szövegszín a bal oldali ikonhoz. */
function severityColor(severity: AppNotification['severity']): string {
  switch (severity) {
    case 'error':
      return 'text-destructive'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-muted-foreground'
  }
}

export function NotificationBell({
  notifications,
  unreadCount,
  isRead,
  markAllRead,
  onNavigate,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false)

  const handleClick = (n: AppNotification) => {
    onNavigate(n.target)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title="Értesítések"
          aria-label={`Értesítések${unreadCount > 0 ? ` (${unreadCount} olvasatlan)` : ''}`}
        >
          <Bell className="w-5 h-5" weight={unreadCount > 0 ? 'fill' : 'regular'} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold text-sm">Értesítések</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Összes olvasott
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <CheckCircle className="w-8 h-8 text-success" weight="duotone" />
            <p className="text-sm text-muted-foreground">Nincs új értesítés</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {notifications.map((n) => {
                const Icon = TYPE_ICON[n.type]
                const unread = !isRead(n.id)
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 ${
                        unread ? 'bg-muted/30' : ''
                      }`}
                    >
                      <Icon className={`mt-0.5 w-5 h-5 shrink-0 ${severityColor(n.severity)}`} weight="fill" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground">{n.message}</p>
                      </div>
                      {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}
