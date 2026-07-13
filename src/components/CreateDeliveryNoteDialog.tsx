/**
 * Szállítólevél / CMR létrehozása a Dokumentumok fülről.
 *
 * Két mód:
 *  - RENDELÉSEKBŐL: a meglévő rendelések közül választva fut a jól bevált lánc
 *    (kiállítási dátum → validáció → készlet-levonás → mentés + nyomtatás).
 *  - EGYÉNI: bárkinek, bármilyen (rendszerben nem lévő) tétellel — szabad címzett
 *    + szabad tétellista, rendelés nélkül. Csak szállítólevél (CMR-hez a nemzetközi
 *    fuvaradatok kellenek, az továbbra is rendelésből készül).
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
import { FileText, MagnifyingGlass, ArrowRight, Plus, Trash, UserPlus, Package } from '@phosphor-icons/react'
import { stripDiacritics, isDelivered, parseFloatSafe } from '@/lib/helpers'
import { unitOf } from '@/lib/materialService'
import type { DeliveryRecipient, ExtraDeliveryItem, InventoryItem, Order } from '@/lib/types'

/** Szerkesztés közbeni tétel — a mennyiség STRING, hogy tizedes is beírható legyen. */
type DraftItem = { name: string; quantity: string; unit: 'db' | 'kg'; notes?: string }

interface CreateDeliveryNoteDialogProps {
  open: boolean
  onClose: () => void
  orders: Order[]
  inventory: InventoryItem[]
  /** Típus + rendelés-idk átadása a meglévő kiállítás-folyamatnak. */
  onCreate: (type: 'delivery' | 'cmr', orderIds: string[]) => void
  /** Egyéni (rendelés nélküli) szállítólevél — címzett + szabad tételek. */
  onCreateCustom: (recipient: DeliveryRecipient, items: ExtraDeliveryItem[]) => void
}

export function CreateDeliveryNoteDialog({
  open, onClose, orders, inventory, onCreate, onCreateCustom,
}: CreateDeliveryNoteDialogProps) {
  const [mode, setMode] = useState<'orders' | 'custom'>('orders')
  const [type, setType] = useState<'delivery' | 'cmr'>('delivery')
  const [customer, setCustomer] = useState<string>('')
  const [search, setSearch] = useState('')
  const [includeDelivered, setIncludeDelivered] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Egyéni mód állapota
  const [recipient, setRecipient] = useState<DeliveryRecipient>({ name: '' })
  // Szerkesztés közben a mennyiség STRING (hogy tizedes / félkész érték is
  // beírható legyen); a kiállításkor számmá alakítjuk.
  const [items, setItems] = useState<DraftItem[]>([])
  const [pickerId, setPickerId] = useState('')

  // Nyitáskor tiszta állapot
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setSelected(new Set()); setSearch(''); setCustomer(''); setMode('orders')
    setRecipient({ name: '' }); setItems([]); setPickerId(''); setPrevOpen(true)
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

  // Egyéni tétel-szerkesztő (ExtraItemsDialog mintájára)
  const setRec = (patch: Partial<DeliveryRecipient>) => setRecipient((r) => ({ ...r, ...patch }))
  const updItem = (i: number, patch: Partial<DraftItem>) =>
    setItems((list) => list.map((row, j) => (j === i ? { ...row, ...patch } : row)))
  const addFreeItem = () => setItems((list) => [...list, { name: '', quantity: '1', unit: 'db' }])
  const addFromInventory = (id: string) => {
    const inv = inventory.find((x) => x.id === id)
    if (!inv) return
    setItems((list) => [
      ...list,
      {
        name: inv.productName || inv.drawingNumber || 'Készlet-tétel',
        quantity: '1',
        unit: unitOf(inv),
        notes: inv.drawingNumber && inv.productName ? inv.drawingNumber : undefined,
      },
    ])
    setPickerId('')
  }
  const customValid =
    recipient.name.trim() !== '' &&
    items.length > 0 &&
    items.every((it) => it.name.trim() !== '' && parseFloatSafe(it.quantity, 0, { allowNegative: false }) > 0)
  const toExtraItems = (): ExtraDeliveryItem[] =>
    items.map((it) => ({
      name: it.name,
      quantity: parseFloatSafe(it.quantity, 0, { allowNegative: false }),
      unit: it.unit,
      notes: it.notes,
    }))

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" weight="duotone" />
            Új szállítólevél / CMR készítése
          </DialogTitle>
          <DialogDescription>
            {mode === 'orders'
              ? 'Válaszd ki a rendeléseket — a folytatásban a megszokott kiállítás fut (dátum, ellenőrzés, készlet, nyomtatás).'
              : 'Egyéni szállítólevél bárkinek, bármilyen tétellel — rendelés nélkül.'}
          </DialogDescription>
        </DialogHeader>

        {/* Mód-váltó */}
        <div className="inline-flex rounded-lg border p-1 bg-muted/40 w-fit">
          <button
            type="button"
            onClick={() => setMode('orders')}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${mode === 'orders' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
          >
            <FileText className="w-4 h-4" /> Rendelésekből
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${mode === 'custom' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground'}`}
          >
            <UserPlus className="w-4 h-4" /> Egyéni
          </button>
        </div>

        {mode === 'orders' ? (
          <>
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
          </>
        ) : (
          <>
            {/* Címzett */}
            <div className="grid gap-2">
              <Label>Címzett</Label>
              <Input
                placeholder="Név / cégnév (kötelező)"
                value={recipient.name}
                onChange={(e) => setRec({ name: e.target.value })}
              />
              <Input
                placeholder="Cím (utca, házszám)"
                value={recipient.address ?? ''}
                onChange={(e) => setRec({ address: e.target.value || undefined })}
              />
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <Input
                  placeholder="Irsz."
                  value={recipient.postalCode ?? ''}
                  onChange={(e) => setRec({ postalCode: e.target.value || undefined })}
                />
                <Input
                  placeholder="Város"
                  value={recipient.city ?? ''}
                  onChange={(e) => setRec({ city: e.target.value || undefined })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Ország"
                  value={recipient.country ?? ''}
                  onChange={(e) => setRec({ country: e.target.value || undefined })}
                />
                <Input
                  placeholder="Adószám (opcionális)"
                  value={recipient.taxNumber ?? ''}
                  onChange={(e) => setRec({ taxNumber: e.target.value || undefined })}
                />
              </div>
            </div>

            {/* Tételek */}
            <div className="flex gap-2 items-end flex-wrap">
              <div className="grid gap-1.5 flex-1 min-w-[220px]">
                <Label className="flex items-center gap-1.5"><Package className="w-4 h-4" /> Tételek</Label>
                <Select value={pickerId} onValueChange={addFromInventory}>
                  <SelectTrigger><SelectValue placeholder="Készletből hozzáadás…" /></SelectTrigger>
                  <SelectContent>
                    {inventory.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.itemType === 'szerszam' ? '🔧 ' : inv.itemType === 'alapanyag' ? '🧱 ' : '📦 '}
                        {inv.productName || inv.drawingNumber} ({inv.quantity.toLocaleString('hu-HU')} {unitOf(inv)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" className="gap-1" onClick={addFreeItem}>
                <Plus className="w-4 h-4" /> Szabad sor
              </Button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto py-1">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Még nincs tétel — adj hozzá készletből vagy szabad sort.</p>
              ) : (
                items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[1fr_90px_80px_1fr_36px] gap-2 items-center">
                    <Input
                      placeholder="Megnevezés"
                      value={item.name}
                      onChange={(e) => updItem(i, { name: e.target.value })}
                    />
                    <Input
                      type="text" inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => updItem(i, { quantity: e.target.value })}
                    />
                    <Select value={item.unit} onValueChange={(v) => updItem(i, { unit: v as 'db' | 'kg' })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="db">db</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Megjegyzés (opcionális)"
                      value={item.notes ?? ''}
                      onChange={(e) => updItem(i, { notes: e.target.value || undefined })}
                    />
                    <Button
                      variant="ghost" size="sm"
                      className="text-destructive hover:text-destructive px-2"
                      onClick={() => setItems((list) => list.filter((_, j) => j !== i))}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="items-center gap-3">
              <span className="mr-auto text-sm text-muted-foreground">
                {customValid && <>Címzett: <b>{recipient.name}</b> · {items.length} tétel</>}
              </span>
              <Button variant="outline" onClick={onClose}>Mégse</Button>
              <Button
                disabled={!customValid}
                className="gap-1"
                onClick={() => {
                  onCreateCustom(recipient, toExtraItems())
                  onClose()
                }}
              >
                Tovább a kiállításhoz <ArrowRight className="w-4 h-4" />
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
