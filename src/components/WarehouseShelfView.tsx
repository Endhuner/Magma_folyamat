/**
 * Raktár — polc elölnézet (a kiválasztott mockup-variáció alapján).
 *
 * Egy állvány szemből: a szintek (polcok) egymás felett, a tételek dobozként
 * "ülnek" a polcon, szélességük a mennyiséggel arányos. A kereső zölden
 * kivilágítja a találatot és odaugrik az állványára. Kattintásra részlet-sáv
 * nyílik (áthelyezés / mozgásnapló / korrekció).
 *
 * A helykód a meglévő `location` mezőben él (`ÁLLVÁNY-SZINT-REKESZ`), így a
 * lista-nézettel és a régi szabad-szöveges helyekkel teljesen kompatibilis.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  MagnifyingGlass, MapPin, ArrowsLeftRight, Clock, Package, Gear, Plus, Trash, Wrench, CheckCircle, Cube,
} from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useAppSetting } from '@/hooks/useAppSetting'
import { stripDiacritics } from '@/lib/helpers'
import { unitOf } from '@/lib/materialService'
import {
  DEFAULT_RACKS,
  buildWarehouseIndex,
  formatLocationCode,
  parseLocationCode,
  occupiedBinCount,
  type RackConfig,
} from '@/lib/warehouseLocation'
import type { InventoryItem } from '@/lib/types'

interface WarehouseShelfViewProps {
  inventory: InventoryItem[]
  /** Helykód mentése (üres string = hely törlése). A hívó auditál és szinkronizál. */
  onUpdateLocation: (item: InventoryItem, newLocation: string) => void
  onShowHistory: (item: InventoryItem) => void
  onAdjust: (item: InventoryItem) => void
}

const boxPalette = (itemType: InventoryItem['itemType']) =>
  itemType === 'szerszam'
    ? 'bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-100'
    : itemType === 'alapanyag'
      ? 'bg-emerald-200 text-emerald-950 dark:bg-emerald-500/30 dark:text-emerald-100'
      : 'bg-blue-200 text-blue-950 dark:bg-blue-500/30 dark:text-blue-100'

const TypeIcon = ({ itemType, className }: { itemType: InventoryItem['itemType']; className?: string }) =>
  itemType === 'szerszam'
    ? <Wrench className={`${className ?? 'w-4 h-4'} text-amber-600`} weight="duotone" />
    : itemType === 'alapanyag'
      ? <Cube className={`${className ?? 'w-4 h-4'} text-emerald-600`} weight="duotone" />
      : <Package className={`${className ?? 'w-4 h-4'} text-blue-600`} weight="duotone" />

export function WarehouseShelfView({
  inventory,
  onUpdateLocation,
  onShowHistory,
  onAdjust,
}: WarehouseShelfViewProps) {
  const auth = useAuth()
  const isAdmin = auth.user?.role === 'admin'

  const [racks, setRacks, racksLoaded] = useAppSetting<RackConfig[]>('warehouse-racks', DEFAULT_RACKS)
  const safeRacks = racks.length > 0 ? racks : DEFAULT_RACKS

  const [activeRackId, setActiveRackId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [moveItem, setMoveItem] = useState<InventoryItem | null>(null)
  const [rackEditorOpen, setRackEditorOpen] = useState(false)

  const index = useMemo(() => buildWarehouseIndex(inventory, safeRacks), [inventory, safeRacks])

  // ── Keresés: ékezet-független; a találatok kiemelése + első találat állványa ──
  const q = stripDiacritics(search)
  const matches = useMemo(() => {
    if (!q) return new Set<string>()
    return new Set(
      inventory
        .filter(
          (i) =>
            stripDiacritics(i.productName).includes(q) ||
            stripDiacritics(i.drawingNumber).includes(q) ||
            stripDiacritics(i.customer).includes(q) ||
            stripDiacritics(i.location).includes(q)
        )
        .map((i) => i.id)
    )
  }, [inventory, q])

  const firstHit = useMemo(() => {
    if (!q) return null
    for (const rack of safeRacks) {
      const placed = index.byRack.get(rack.id.toUpperCase()) ?? []
      const hit = placed.find((p) => matches.has(p.item.id))
      if (hit) return { rack, hit }
    }
    return null
  }, [q, safeRacks, index, matches])

  // Kereséskor EGYSZER odaugrunk az első találat állványára, de utána a kézi
  // állvány-választás nyer — így keresés közben is lehet böngészni a többi
  // állványt (a találatok ott is kiemelve maradnak).
  useEffect(() => {
    if (firstHit) setActiveRackId(firstHit.rack.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const activeRack =
    safeRacks.find((r) => r.id === activeRackId) ??
    safeRacks[0]

  const placedOnActive = index.byRack.get(activeRack.id.toUpperCase()) ?? []
  const selectedItem = inventory.find((i) => i.id === selectedId) ?? null

  // Szintenként csoportosítva, felülről lefelé rendereljük
  const levels = useMemo(() => {
    const byLevel = new Map<number, typeof placedOnActive>()
    for (let l = 1; l <= activeRack.levels; l++) byLevel.set(l, [])
    for (const p of placedOnActive) byLevel.get(p.loc.level)?.push(p)
    for (const list of byLevel.values()) list.sort((a, b) => a.loc.bin - b.loc.bin)
    return [...byLevel.entries()].sort((a, b) => b[0] - a[0]) // 4 → 1
  }, [placedOnActive, activeRack.levels])

  return (
    <div className="space-y-4">
      {/* Állvány-választó + kereső */}
      <div className="flex items-center gap-2 flex-wrap">
        {safeRacks.map((rack) => {
          const placed = index.byRack.get(rack.id.toUpperCase()) ?? []
          const isActive = rack.id === activeRack.id
          return (
            <Button
              key={rack.id}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              className="coarse:h-10"
              onClick={() => setActiveRackId(rack.id)}
            >
              {rack.name}
              <Badge variant={isActive ? 'secondary' : 'outline'} className="ml-2 text-[10px]">
                {occupiedBinCount(placed)}/{rack.levels * rack.binsPerLevel}
              </Badge>
            </Button>
          )
        })}
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            title="Állványok szerkesztése"
            // A szerkesztő csak a szerver-beállítás betöltése UTÁN nyitható —
            // különben a default kiosztás felülírhatná a közös konfigurációt.
            disabled={!racksLoaded}
            onClick={() => setRackEditorOpen(true)}
          >
            <Gear className="w-4 h-4" />
          </Button>
        )}
        <div className="relative ml-auto min-w-[240px] flex-1 sm:flex-none sm:w-[320px]">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hol van? — termék, rajzszám, helykód…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`pl-9 ${firstHit ? 'border-green-600 ring-1 ring-green-600/40' : ''}`}
          />
        </div>
      </div>

      {/* Találat-sáv */}
      {q && (
        firstHit ? (
          <div className="flex items-center gap-3 rounded-lg border border-green-600/60 bg-green-600/10 px-4 py-2.5 flex-wrap">
            <MapPin className="w-5 h-5 text-green-700 dark:text-green-400" weight="fill" />
            <span>
              <b>{firstHit.hit.item.productName || firstHit.hit.item.drawingNumber}</b> megtalálva:{' '}
              <span className="font-mono font-bold bg-green-700 text-white rounded px-2 py-0.5">
                {formatLocationCode(firstHit.hit.loc.rackId, firstHit.hit.loc.level, firstHit.hit.loc.bin)}
              </span>
              <span className="text-muted-foreground ml-2">
                {firstHit.rack.name}, {firstHit.hit.loc.level}. szint, {firstHit.hit.loc.bin}. oszlop
              </span>
            </span>
            {matches.size > 1 && (
              <span className="text-sm text-muted-foreground">(+{matches.size - 1} további találat)</span>
            )}
          </div>
        ) : (
          <div className="rounded-lg border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            Nincs elhelyezett találat erre: „{search}" — nézd meg lent a hely nélküli tételeket.
          </div>
        )
      )}

      {/* Az állvány elölnézete */}
      <Card className="p-5 relative overflow-x-auto">
        <div className="flex justify-between mb-2 items-baseline gap-3 flex-wrap">
          <b className="text-base">{activeRack.name}</b>
          <span className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
            <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-300 dark:bg-blue-500/50 align-[-1px]" /> kész termék</span>
            <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-300 dark:bg-amber-500/50 align-[-1px]" /> szerszám</span>
            <span><span className="inline-block w-3 h-3 rounded-sm bg-emerald-300 dark:bg-emerald-500/50 align-[-1px]" /> alapanyag</span>
          </span>
          <span className="text-sm text-muted-foreground">
            {occupiedBinCount(placedOnActive)}/{activeRack.levels * activeRack.binsPerLevel} rekesz foglalt
            {!racksLoaded && ' · betöltés…'}
          </span>
        </div>

        {/* Oszlop-fejléc — melyik rekesz-oszlop hányas */}
        <div className="flex items-stretch gap-2 mb-1 w-max min-w-full">
          <span className="shrink-0 w-14" />
          <div
            className="grid gap-2 flex-1 min-w-0"
            style={{ gridTemplateColumns: `repeat(${activeRack.binsPerLevel}, minmax(110px, 1fr))` }}
          >
            {Array.from({ length: activeRack.binsPerLevel }, (_, i) => (
              <span key={i} className="text-[10px] text-center text-muted-foreground truncate">{i + 1}. oszlop</span>
            ))}
          </div>
        </div>

        {levels.map(([level, items]) => {
          // Oszlopok (rekeszek) szerint csoportosítva — egy rekeszben több tétel is lehet.
          const byBin = new Map<number, typeof items>()
          for (let b = 1; b <= activeRack.binsPerLevel; b++) byBin.set(b, [])
          for (const p of items) byBin.get(p.loc.bin)?.push(p)
          return (
            <div
              key={level}
              className="flex items-stretch gap-2 px-2 pt-2 pb-1.5 min-h-[76px] border-b-[10px] border-slate-400 dark:border-slate-500 w-max min-w-full"
            >
              {/* sticky címke: vízszintes görgetésnél is látszik, melyik szint ez */}
              <span className="sticky left-0 z-10 self-center shrink-0 w-14 text-[11px] text-muted-foreground bg-card/95 rounded pr-1">
                {level}. szint
              </span>
              <div
                className="grid gap-2 flex-1 min-w-0"
                style={{ gridTemplateColumns: `repeat(${activeRack.binsPerLevel}, minmax(110px, 1fr))` }}
              >
                {[...byBin.entries()].map(([bin, binItems]) => (
                  <div key={bin} className="flex flex-col gap-1 min-h-[52px]">
                    {binItems.length === 0 ? (
                      <div className="flex-1 rounded-md border border-dashed border-slate-300 dark:border-slate-600 min-h-[48px]" />
                    ) : (
                      binItems.map(({ item, loc }) => {
                        const hit = matches.has(item.id)
                        const sel = selectedId === item.id
                        return (
                          <button
                            key={item.id}
                            onClick={() => setSelectedId(sel ? null : item.id)}
                            className={`w-full rounded-t-md rounded-b-sm px-2 py-1.5 text-left text-[11px] leading-tight cursor-pointer
                                        shadow-[inset_0_-3px_0_rgba(0,0,0,.15)] ${boxPalette(item.itemType)}
                                        ${hit ? 'ring-[3px] ring-green-600 ring-offset-2 ring-offset-background' : ''}
                                        ${sel ? 'outline outline-2 outline-primary' : ''}`}
                            title={`${item.productName} · ${item.quantity} db · ${item.location}`}
                          >
                            <span className="block font-semibold text-xs truncate">
                              {item.productName || item.drawingNumber || '—'}
                            </span>
                            <span className="block truncate opacity-80">
                              {item.quantity.toLocaleString('hu-HU')} {unitOf(item)} · {formatLocationCode(loc.rackId, loc.level, loc.bin)}
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* állvány-lábak */}
        <div className="flex justify-between px-1 pt-0">
          <div className="w-3 h-6 bg-slate-500 dark:bg-slate-600 rounded-b" />
          <div className="w-3 h-6 bg-slate-500 dark:bg-slate-600 rounded-b" />
        </div>
      </Card>

      {/* Kiválasztott tétel részlet-sávja */}
      {selectedItem && (
        <Card className="p-4 flex items-center gap-4 flex-wrap border-primary">
          <TypeIcon itemType={selectedItem.itemType} className="w-5 h-5" />
          <div className="min-w-0">
            <b>{selectedItem.productName || selectedItem.drawingNumber}</b>
            <span className="text-muted-foreground"> · {selectedItem.customer || '—'}</span>
            <span className="ml-2 font-mono text-sm bg-muted rounded px-2 py-0.5">{selectedItem.location || 'nincs hely'}</span>
          </div>
          <b className="font-mono">{selectedItem.quantity.toLocaleString('hu-HU')} {unitOf(selectedItem)}</b>
          <div className="ml-auto flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => setMoveItem(selectedItem)}>
              <ArrowsLeftRight className="w-4 h-4" /> Áthelyezés
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onShowHistory(selectedItem)}>
              <Clock className="w-4 h-4" /> Mozgásnapló
            </Button>
            <Button size="sm" className="gap-1" onClick={() => onAdjust(selectedItem)}>
              Korrekció
            </Button>
          </div>
        </Card>
      )}

      {/* Hely nélküli / hibás helyű tételek */}
      {(index.unplaced.length > 0 || index.orphaned.length > 0) && (
        <Card className="p-4">
          <b className="text-sm">Hely nélküli tételek ({index.unplaced.length + index.orphaned.length})</b>
          <p className="text-xs text-muted-foreground mb-3">
            Üres vagy szabad-szöveges hellyel — az „Elhelyezés" gombbal tehetők polcra.
          </p>
          <div className="space-y-1.5">
            {[...index.unplaced, ...index.orphaned.map((o) => o.item)].map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                <TypeIcon itemType={item.itemType} className="w-4 h-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  {/* Termék neve + rajzszám (megnevezés) — mindkettő látszik. */}
                  <div className="font-medium truncate">{item.productName || item.drawingNumber || item.id}</div>
                  {item.productName && item.drawingNumber && (
                    <div className="text-xs text-muted-foreground truncate">{item.drawingNumber}</div>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0">{item.quantity.toLocaleString('hu-HU')} {unitOf(item)}</span>
                {item.location && (
                  <span className="text-xs text-muted-foreground italic truncate">„{item.location}"</span>
                )}
                <Button size="sm" variant="outline" className="ml-auto gap-1 shrink-0" onClick={() => setMoveItem(item)}>
                  <MapPin className="w-4 h-4" /> Elhelyezés
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Áthelyezés dialógus — a key tételenként újraindítja az állapotot,
          így mindig a tétel AKTUÁLIS helyéről indul, nem az előző tételéről. */}
      <MoveDialog
        key={moveItem?.id ?? 'none'}
        item={moveItem}
        racks={safeRacks}
        inventory={inventory}
        onClose={() => setMoveItem(null)}
        onSave={(item, newLocation) => {
          onUpdateLocation(item, newLocation)
          setMoveItem(null)
        }}
      />

      {/* Állvány-szerkesztő (admin) */}
      {isAdmin && (
        <RackEditorDialog
          open={rackEditorOpen}
          racks={safeRacks}
          onClose={() => setRackEditorOpen(false)}
          onSave={async (next) => {
            await setRacks(next)
            setRackEditorOpen(false)
            toast.success('Állvány-kiosztás mentve')
          }}
        />
      )}
    </div>
  )
}

// ─── Áthelyezés dialógus ────────────────────────────────────────────────────

function MoveDialog({
  item,
  racks,
  inventory,
  onClose,
  onSave,
}: {
  item: InventoryItem | null
  racks: RackConfig[]
  inventory: InventoryItem[]
  onClose: () => void
  onSave: (item: InventoryItem, newLocation: string) => void
}) {
  // Kezdőérték a tétel JELENLEGI helyéről (ha értelmezhető és a kiosztáson
  // belül van) — a key={item.id} miatt ez tételenként újra lefut.
  const parsed = item ? parseLocationCode(item.location) : null
  const seedRack =
    (parsed && racks.find((r) => r.id.toUpperCase() === parsed.rackId)) || racks[0]
  const seedOnRack = !!(parsed && seedRack && parsed.rackId === seedRack.id.toUpperCase())
  const [rackId, setRackId] = useState(seedRack?.id ?? 'A')
  const [level, setLevel] = useState(seedOnRack && parsed!.level <= (seedRack?.levels ?? 1) ? parsed!.level : 1)
  const [bin, setBin] = useState(seedOnRack && parsed!.bin <= (seedRack?.binsPerLevel ?? 1) ? parsed!.bin : 1)

  const rack = racks.find((r) => r.id === rackId) ?? racks[0]
  // Ha a kiosztás közben szűkült (pl. admin átállította), a mentett kód akkor
  // se mutasson a kiosztáson kívülre — korlátok közé szorítjuk.
  const safeLevel = rack ? Math.min(level, rack.levels) : level
  const safeBin = rack ? Math.min(bin, rack.binsPerLevel) : bin
  const code = rack ? formatLocationCode(rack.id, safeLevel, safeBin) : ''

  // Kik vannak már ezen a rekeszen (tájékoztatás — több tétel is megengedett)
  const occupants = useMemo(
    () =>
      inventory.filter(
        (i) => {
          if (i.id === item?.id) return false
          const loc = parseLocationCode(i.location)
          return !!loc && rack != null &&
            loc.rackId === rack.id.toUpperCase() && loc.level === safeLevel && loc.bin === safeBin
        }
      ),
    [inventory, item, rack, safeLevel, safeBin]
  )

  if (!item || !rack) return null

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" weight="duotone" />
            {item.productName || item.drawingNumber} — elhelyezés
          </DialogTitle>
          <DialogDescription>
            Jelenlegi hely: {item.location ? <span className="font-mono">{item.location}</span> : 'nincs'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 py-2">
          <div className="grid gap-1.5">
            <Label>Állvány</Label>
            <Select value={rackId} onValueChange={(v) => { setRackId(v); setLevel(1); setBin(1) }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {racks.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Szint</Label>
            <Select value={String(safeLevel)} onValueChange={(v) => setLevel(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: rack.levels }, (_, i) => i + 1).map((l) => (
                  <SelectItem key={l} value={String(l)}>{l}. szint</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Oszlop</Label>
            <Select value={String(safeBin)} onValueChange={(v) => setBin(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: rack.binsPerLevel }, (_, i) => i + 1).map((b) => (
                  <SelectItem key={b} value={String(b)}>{b}. oszlop</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm flex items-center gap-2">
          Új hely: <span className="font-mono font-bold">{code}</span>
          {occupants.length > 0 && (
            <span className="text-xs text-warning-foreground bg-warning/60 rounded px-2 py-0.5">
              a rekeszen már van: {occupants.map((o) => o.productName || o.drawingNumber).join(', ')}
            </span>
          )}
        </div>

        <DialogFooter className="gap-2">
          {item.location && (
            <Button variant="ghost" className="mr-auto text-destructive hover:text-destructive gap-1" onClick={() => onSave(item, '')}>
              <Trash className="w-4 h-4" /> Hely törlése
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button className="gap-1" onClick={() => onSave(item, code)}>
            <CheckCircle className="w-4 h-4" weight="fill" /> Elhelyezés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Állvány-szerkesztő (admin) ─────────────────────────────────────────────

function RackEditorDialog({
  open,
  racks,
  onClose,
  onSave,
}: {
  open: boolean
  racks: RackConfig[]
  onClose: () => void
  onSave: (racks: RackConfig[]) => void | Promise<void>
}) {
  const [draft, setDraft] = useState<RackConfig[]>(racks)
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) { setDraft(racks.map((r) => ({ ...r }))); setPrevOpen(true) }
  if (!open && prevOpen) setPrevOpen(false)

  const upd = (i: number, patch: Partial<RackConfig>) =>
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  // Az azonosítónak a helykód-nyelvtannak is meg kell felelnie (betűvel kezdődik,
  // csak A–Z/0–9) — különben a parseLocationCode nem ismerné fel a ráírt kódokat,
  // és a tételek csendben a "hely nélküli" listába kerülnének.
  const RACK_ID_RE = /^[A-Z][A-Z0-9]{0,3}$/
  const valid =
    draft.length > 0 &&
    draft.every((r) => RACK_ID_RE.test(r.id.trim().toUpperCase()) && r.name.trim() && r.levels >= 1 && r.levels <= 10 && r.binsPerLevel >= 1 && r.binsPerLevel <= 20) &&
    new Set(draft.map((r) => r.id.trim().toUpperCase())).size === draft.length

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Állványok szerkesztése</DialogTitle>
          <DialogDescription>
            Az azonosító a helykód első tagja (pl. „A" → A-2-3): 1–4 karakter, betűvel kezdődik (A–Z, 0–9).
            Meglévő helykódokat a módosítás nem ír át.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1 max-h-[340px] overflow-y-auto">
          <div className="grid grid-cols-[64px_1fr_84px_84px_36px] gap-2 text-xs text-muted-foreground px-1">
            <span>Azon.</span><span>Név</span><span>Szintek</span><span>Oszlopszám</span><span />
          </div>
          {draft.map((r, i) => (
            <div key={i} className="grid grid-cols-[64px_1fr_84px_84px_36px] gap-2 items-center">
              <Input
                value={r.id}
                maxLength={4}
                onChange={(e) => upd(i, { id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              />
              <Input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} />
              <Input type="number" min={1} max={10} value={r.levels}
              inputMode="decimal"
                     onChange={(e) => upd(i, { levels: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
              <Input type="number" min={1} max={20} value={r.binsPerLevel}
              inputMode="decimal"
                     onChange={(e) => upd(i, { binsPerLevel: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} />
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive px-2"
                      onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} disabled={draft.length <= 1}>
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline" size="sm" className="gap-1 w-fit"
          onClick={() => setDraft((d) => [...d, { id: '', name: 'Új állvány', levels: 4, binsPerLevel: 5 }])}
        >
          <Plus className="w-4 h-4" /> Állvány hozzáadása
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button disabled={!valid} onClick={() => onSave(draft.map((r) => ({ ...r, id: r.id.trim().toUpperCase(), name: r.name.trim() })))}>
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
