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
import { ChatCircleDots, PaperPlaneRight, CheckCircle, ClipboardText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { generateId } from '@/lib/generateId'
import type { AppMessage } from '@/lib/types'
import type { ServerCrudApi } from '@/lib/providers/useServerCrud'

interface PublicUser {
  id: string
  name: string
  role: string
}

interface MessageCenterProps {
  messagesApi: ServerCrudApi<AppMessage>
  currentUser: { id: string; name: string } | null
}

/**
 * Üzenet- és feladatküldő központ a fejlécben.
 *
 * - Ha olvasatlan üzenet érkezik (SSE-n azonnal), a gombon villogó piros
 *   felkiáltójel-jelvény jelenik meg.
 * - A panel megnyitásakor a beérkezett olvasatlanok olvasottá válnak.
 * - Feladat típusú üzenetet a címzett „Kész"-re állíthat.
 */
export function MessageCenter({ messagesApi, currentUser }: MessageCenterProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<PublicUser[]>([])
  const [toUserId, setToUserId] = useState<string>('all')
  const [kind, setKind] = useState<'uzenet' | 'feladat'>('uzenet')
  const [body, setBody] = useState('')

  const me = currentUser?.id ?? ''

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
    const target = users.find((u) => u.id === toUserId)
    const now = new Date().toISOString()
    messagesApi.add({
      id: generateId(),
      kind,
      body: text,
      fromUserId: currentUser.id,
      fromUserName: currentUser.name,
      toUserId,
      toUserName: toUserId === 'all' ? 'Mindenki' : target?.name ?? '',
      readAt: '',
      doneAt: '',
      createdAt: now,
      updatedAt: now,
    })
    setBody('')
    toast.success(kind === 'feladat' ? 'Feladat kiküldve' : 'Üzenet elküldve')
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Címzett</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Mindenki</SelectItem>
                  {users.filter((u) => u.id !== me).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
