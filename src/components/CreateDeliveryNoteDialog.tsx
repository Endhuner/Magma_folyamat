/**
 * Szállítólevél / CMR létrehozása a Dokumentumok fülről.
 *
 * Eddig csak a Rendelések fülről (sorok kijelölésével) lehetett kiállítani —
 * ez a dialógus ugyanabba a meglévő folyamatba csatlakozik: típus + vevő +
 * rendelések kiválasztása után a jól bevált lánc fut (kiállítási dátum →
 * validáció → készlet-levonás → mentés + nyomtatás).
 */
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FileText, MagnifyingGlass, ArrowRight } from '@phosphor-icons/react'
import { stripDiacritics, isDelivered } from '@/lib/helpers'
import type { Order } from '@/lib/types'

interface CreateDeliveryNoteDialogProps {
  open: boolean
  onClose: () => void
  orders: Order[]
  /** Típus + rendelés-idk átadása a meglévő kiállítás-folyamatnak. */
  onCreate: (type: 'delivery' | 'cmr', orderIds: string[]) => void
}

export function CreateDeliveryNoteDialog({ open, onClose, orders, onCreate }: CreateDeliveryNoteDialogProps) {
  const [type, setType] = useState<'delivery' | 'cmr'>('delivery')
  const [customer, setCustomer] = useState<string>('')
  const [search, setSearch] = useState('')
  const [includeDelivered, setIncludeDelivered] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Nyitáskor tiszta állapot
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setSelected(new Set()); setSearch(''); setCustomer(''); setPrevOpen(true)
  }
  if (!open && prevOpen) setPrevOpen(false)

  const customersWithOrders = useMemo(() => {
    const names = new Set<string>()
    for (const o of orders) {
      if (includeDelivered || !isDelivered(o.status)) names.add(o.customer)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'hu'))
  }, [orders, includeDelivered])

  const candidates = useMemo(() => {
    const q = stripDiacritics(search)
    return orders
      .filter((o) => !customer || o.customer === customer)
      .filter((o) => includeDelivered || !isDelivered(o.status))
      .filter(
        (o) =>
          !q ||
          stripDiacritics(o.ownOrderNumber).includes(q) ||
          stripDiacritics(o.orderNumber).includes(q) ||
          stripDiacritics(o.productName).includes(q)
      )
      .sort((a, b) => (a.ownOrderNumber < b.ownOrderNumber ? 1 : -1))
  }, [orders, customer, search, includeDelivered])

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  // Egy szállítólevél egy vevőé — az első kijelölés rögzíti a vevőt.
  const selectedOrders = orders.filter((o) => selected.has(o.id))
  const selectedCustomer = selectedOrders[0]?.customer
  const mixedCustomers = new Set(selectedOrders.map((o) => o.customer)).size > 1

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" weight="duotone" />
            Új szállítólevél / CMR készítése
          </DialogTitle>
          <DialogDescription>
            Válaszd ki a rendeléseket — a folytatásban a megszokott kiállítás fut
            (dátum, ellenőrzés, készlet, nyomtatás).
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Dokumentum típusa</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'delivery' | 'cmr')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Szállítólevél (SZL)</SelectItem>
                <SelectItem value="cmr">CMR fuvarlevél</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Vevő</Label>
            <Select value={customer || 'mind'} onValueChange={(v) => setCustomer(v === 'mind' ? '' : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mind">Összes vevő</SelectItem>
                {customersWithOrders.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Keresés: rendelésszám, termék…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={includeDelivered} onCheckedChange={setIncludeDelivered} />
            kiszállítottak is
          </label>
        </div>

        <div className="border rounded-lg max-h-[280px] overflow-y-auto divide-y">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nincs megfelelő rendelés.</p>
          ) : (
            candidates.map((o) => (
              <label
                key={o.id}
                className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/50"
              >
                <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                <span className="font-mono font-semibold shrink-0">{o.ownOrderNumber || o.orderNumber}</span>
                <span className="truncate">{o.productName}</span>
                <span className="text-muted-foreground shrink-0">{(o.amountPc || 0).toLocaleString('hu-HU')} db</span>
                <span className="text-muted-foreground truncate hidden sm:inline">{o.customer}</span>
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">{o.status}</Badge>
              </label>
            ))
          )}
        </div>

        {mixedCustomers && (
          <p className="text-sm text-destructive font-medium">
            Több vevő rendelése van kijelölve — egy szállítólevél csak egy vevőé lehet.
          </p>
        )}

        <DialogFooter className="items-center gap-3">
          <span className="mr-auto text-sm text-muted-foreground">
            {selected.size > 0 && !mixedCustomers && (
              <>Kijelölve: <b>{selected.size} rendelés</b> · {selectedCustomer}</>
            )}
          </span>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button
            disabled={selected.size === 0 || mixedCustomers}
            className="gap-1"
            onClick={() => {
              onCreate(type, [...selected])
              onClose()
            }}
          >
            Tovább a kiállításhoz <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
