import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ChatCircleDots, PaperPlaneRight, CheckCircle, ClipboardText, MagnifyingGlass, X, Wrench } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { generateId } from '@/lib/generateId'
import { stripDiacritics, isDelivered } from '@/lib/helpers'
import type { AppMessage, Order } from '@/lib/types'
import type { ServerCrudApi } from '@/lib/providers/useServerCrud'

interface PublicUser {
  id: string
  name: string
  role: string
}

interface MessageCenterProps {
  messagesApi: ServerCrudApi<AppMessage>
  currentUser: { id: string; name: string } | null
  /** Rendelések a feladat-csatoláshoz (aktív munkára hivatkozás). */
  orders?: Order[]
}

/**
 * Üzenet- és feladatküldő központ a fejlécben.
 *
 * - Ha olvasatlan üzenet érkezik (SSE-n azonnal), a gombon villogó piros
 *   felkiáltójel-jelvény jelenik meg.
 * - A panel megnyitásakor a beérkezett olvasatlanok olvasottá válnak.
 * - Feladat típusú üzenetet a címzett „Kész"-re állíthat.
 */
export function MessageCenter({ messagesApi, currentUser, orders = [] }: MessageCenterProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<PublicUser[]>([])
  // Több címzett: 'all' (mindenki) | 'operators' (összes operátor) | userId-k
  const [recipients, setRecipients] = useState<Set<string>>(new Set(['all']))
  const [kind, setKind] = useState<'uzenet' | 'feladat'>('uzenet')
  const [body, setBody] = useState('')
  // Rendelés-csatolás (feladat aktív munkához)
  const [orderSearch, setOrderSearch] = useState('')
  const [linkedOrder, setLinkedOrder] = useState<{ id: string; label: string } | null>(null)

  const me = currentUser?.id ?? ''

  const toggleRecipient = (key: string) => {
    setRecipients((prev) => {
      const next = new Set(prev)
      if (key === 'all') return new Set(['all']) // a Mindenki kizárólagos
      next.delete('all')
      if (next.has(key)) next.delete(key)
      else next.add(key)
      if (next.size === 0) next.add('all')
      return next
    })
  }

  const orderHits = useMemo(() => {
    const q = stripDiacritics(orderSearch)
    if (!q) return []
    return orders
      .filter((o) => !isDelivered(o.status))
      .filter(
        (o) =>
          stripDiacritics(o.ownOrderNumber).includes(q) ||
          stripDiacritics(o.orderNumber).includes(q) ||
          stripDiacritics(o.productName).includes(q) ||
          stripDiacritics(o.customer).includes(q)
      )
      .slice(0, 6)
  }, [orders, orderSearch])

  // Címzett-lista a login-képernyő publikus user-végpontjáról.
  useEffect(() => {
    fetch('/api/v1/auth/users-public', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<PublicUser[]>) : Promise.resolve([])))
      .then(setUsers)
      .catch(() => setUsers([]))
  }, [])

  // Nekem szóló üzenetek (személyes vagy mindenkinek), a sajátjaimat kivéve.
  const received = useMemo(
    () =>
      messagesApi.items
        .filter((m) => (m.toUserId === me || m.toUserId === 'all') && m.fromUserId !== me)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [messagesApi.items, me]
  )

  const unread = useMemo(() => received.filter((m) => !m.readAt), [received])
  const openTasks = useMemo(
    () => received.filter((m) => m.kind === 'feladat' && !m.doneAt).length,
    [received]
  )

  // Panel megnyitásakor: minden olvasatlan beérkezett üzenet olvasottá tétele.
  useEffect(() => {
    if (!open || unread.length === 0) return
    const now = new Date().toISOString()
    for (const m of unread) {
      messagesApi.update(m.id, { readAt: now } as Partial<AppMessage>)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const send = () => {
    if (!currentUser) return
    const text = body.trim()
    if (!text) {
      toast.error('Írj üzenetet')
      return
    }
    const now = new Date().toISOString()
    const base = {
      kind,
      body: text,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      orderId: linkedOrder?.id ?? '',
      orderLabel: linkedOrder?.label ?? '',
      readAt: '',
      doneAt: '',
      createdAt: now,
      updatedAt: now,
    }

    if (recipients.has('all')) {
      messagesApi.add({ ...base, id: generateId(), toUserId: 'all', toUserName: 'Mindenki' })
      toast.success(kind === 'feladat' ? 'Feladat kiküldve mindenkinek' : 'Üzenet elküldve mindenkinek')
    } else {
      // Címzett-lista kibontása: 'operators' → az összes operátor; duplikátum-
      // és önküldés-szűrés. Mindenki SAJÁT példányt kap (külön kész-jelöléshez).
      const targetIds = new Set<string>()
      for (const key of recipients) {
        if (key === 'operators') {
          users.filter((u) => u.role === 'operator').forEach((u) => targetIds.add(u.id))
        } else {
          targetIds.add(key)
        }
      }
      targetIds.delete(me)
      if (targetIds.size === 0) {
        toast.error('Nincs érvényes címzett')
        return
      }
      for (const id of targetIds) {
        const u = users.find((x) => x.id === id)
        messagesApi.add({ ...base, id: generateId(), toUserId: id, toUserName: u?.name ?? '' })
      }
      toast.success(
        kind === 'feladat'
          ? `Feladat kiküldve ${targetIds.size} személynek`
          : `Üzenet elküldve ${targetIds.size} személynek`
      )
    }
    setBody('')
    setLinkedOrder(null)
    setOrderSearch('')
  }

  const markDone = (m: AppMessage) => {
    messagesApi.update(m.id, { doneAt: new Date().toISOString() } as Partial<AppMessage>)
    toast.success('Feladat készre jelölve')
  }

  const fmtTime = (iso: string) => {
    try {
      return format(new Date(iso), 'MM. dd. HH:mm', { locale: hu })
    } catch {
      return iso
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 coarse:h-10 coarse:w-10"
          title="Üzenetek és feladatok"
          aria-label={unread.length > 0 ? `${unread.length} olvasatlan üzenet` : 'Üzenetek'}
        >
          <ChatCircleDots className="w-5 h-5" weight={unread.length > 0 ? 'fill' : 'bold'} />
          {unread.length > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 w-4 animate-pulse items-center justify-center
                         rounded-full bg-destructive text-[11px] font-bold leading-none text-destructive-foreground
                         ring-2 ring-background"
            >
              !
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <ChatCircleDots className="w-5 h-5" weight="duotone" />
            Üzenetek és feladatok
            {openTasks > 0 && (
              <Badge variant="secondary" className="ml-1">{openTasks} nyitott feladat</Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Küldj üzenetet vagy feladatot a többieknek — a címzettnél azonnal villog a jelzés.
          </SheetDescription>
        </SheetHeader>

        {/* Küldés */}
        <div className="border-b p-4 space-y-3">
          <div className="grid gap-1.5">
            <Label>Címzettek (többet is választhatsz)</Label>
            <div className="flex flex-wrap gap-1.5">
              <Badge
                variant={recipients.has('all') ? 'default' : 'outline'}
                className="cursor-pointer select-none coarse:py-1.5"
                onClick={() => toggleRecipient('all')}
              >
                Mindenki
              </Badge>
              <Badge
                variant={recipients.has('operators') ? 'default' : 'outline'}
                className="cursor-pointer select-none coarse:py-1.5"
                onClick={() => toggleRecipient('operators')}
              >
                Összes operátor
              </Badge>
              {users.filter((u) => u.id !== me).map((u) => (
                <Badge
                  key={u.id}
                  variant={recipients.has(u.id) ? 'default' : 'outline'}
                  className="cursor-pointer select-none coarse:py-1.5"
                  onClick={() => toggleRecipient(u.id)}
                >
                  {u.name}
                </Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Típus</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as 'uzenet' | 'feladat')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uzenet">Üzenet</SelectItem>
                  <SelectItem value="feladat">Feladat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Rendelés csatolása</Label>
              {linkedOrder ? (
                <div className="flex items-center gap-1 rounded-md border px-2 h-9 text-sm">
                  <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate font-medium">{linkedOrder.label}</span>
                  <Button
                    variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0 shrink-0"
                    onClick={() => setLinkedOrder(null)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    className="w-full h-9 rounded-md border bg-transparent pl-8 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Keresés: M26…, termék…"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  {orderHits.length > 0 && (
                    <div className="absolute z-50 top-10 left-0 right-0 rounded-md border bg-popover shadow-md overflow-hidden">
                      {orderHits.map((o) => (
                        <button
                          key={o.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex gap-2 items-baseline"
                          onClick={() => {
                            setLinkedOrder({
                              id: o.id,
                              label: `${o.ownOrderNumber || o.orderNumber} · ${o.productName}`,
                            })
                            setOrderSearch('')
                          }}
                        >
                          <span className="font-mono font-semibold shrink-0">{o.ownOrderNumber || o.orderNumber}</span>
                          <span className="truncate">{o.productName}</span>
                          <span className="text-muted-foreground text-xs truncate ml-auto">{o.customer}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <Textarea
            rows={2}
            placeholder={kind === 'feladat' ? 'Mi a feladat? (pl. Ellenőrizd a CNC-01 olajszintjét)' : 'Írd az üzenetet…'}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
            }}
          />
          <Button onClick={send} disabled={!body.trim()} className="w-full gap-2">
            <PaperPlaneRight className="w-4 h-4" weight="fill" />
            Küldés
          </Button>
        </div>

        {/* Beérkezett lista */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nincs beérkezett üzeneted.
            </p>
          ) : (
            received.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg border p-3 space-y-1.5 ${!m.readAt ? 'border-destructive/50 bg-destructive/5' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{m.fromUserName || 'Ismeretlen'}</span>
                    {m.toUserId === 'all' && <Badge variant="outline" className="text-[10px]">Mindenki</Badge>}
                    {m.kind === 'feladat' && (
                      <Badge variant={m.doneAt ? 'secondary' : 'default'} className="gap-1 text-[10px]">
                        <ClipboardText className="w-3 h-3" />
                        {m.doneAt ? 'Kész' : 'Feladat'}
                      </Badge>
                    )}
                    {m.orderLabel && (
                      <Badge variant="outline" className="text-[10px] font-mono max-w-[180px] truncate" title={m.orderLabel}>
                        {m.orderLabel}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtTime(m.createdAt)}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                {m.kind === 'feladat' && !m.doneAt && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => markDone(m)}>
                    <CheckCircle className="w-4 h-4" weight="fill" />
                    Kész
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
