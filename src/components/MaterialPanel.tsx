/**
 * Alapanyag-panel — az anyagkészlet élő becslése + műveletek.
 *
 * Három helyen jelenik meg (D csomag): Gyártás fül (kompakt), Rendelések
 * mellett közvetve (összesítő sáv), Készlet fül „Alapanyag-tároló" blokk.
 *
 * A becslés: könyvelt készlet − a napi könyvelés utáni műszakok számított
 * fogyása. A bevét/visszaolvasztás/leltár az öntők számára is elérhető.
 */
import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Cube, Plus, Recycle, Scales, Warning, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useAppSetting } from '@/hooks/useAppSetting'
import { parseFloatSafe } from '@/lib/helpers'
import {
  computeMaterialStatuses,
  buildMaterialAction,
  MATERIAL_ACTION_LABEL,
  MATERIAL_BOOKED_THROUGH_KEY,
  type MaterialActionKind,
  type MaterialBookedThroughMap,
  type MaterialStatus,
} from '@/lib/materialService'
import type {
  InventoryItem, InventoryTransaction, Order, Product, ProductionShift,
} from '@/lib/types'

interface MaterialPanelProps {
  inventory: InventoryItem[]
  shifts: ProductionShift[]
  orders: Order[]
  products: Product[]
  transactions: InventoryTransaction[]
  /** A hívó menti az új tételt + mozgást (szinkron + audit a hívó oldalán). */
  onApply: (result: { updatedItem: InventoryItem; transaction: InventoryTransaction; kind: MaterialActionKind }) => void
  /** Kompakt mód a Gyártás fülhöz (kisebb kártyák, cím nélkül). */
  compact?: boolean
  title?: string
}

function fmtKg(n: number): string {
  return `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} kg`
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

export function MaterialPanel({
  inventory, shifts, orders, products, transactions, onApply, compact, title,
}: MaterialPanelProps) {
  const auth = useAuth()
  const [bookedThrough, setBookedThrough] =
    useAppSetting<MaterialBookedThroughMap>(MATERIAL_BOOKED_THROUGH_KEY, {})

  const statuses = useMemo(
    () => computeMaterialStatuses(inventory, shifts, orders, products, transactions, bookedThrough),
    [inventory, shifts, orders, products, transactions, bookedThrough]
  )

  const [action, setAction] = useState<{ status: MaterialStatus; kind: MaterialActionKind } | null>(null)

  if (statuses.length === 0) {
    // Nincs alapanyag felvéve — a Készlet fülön rövid útmutató, máshol semmi.
    if (compact) return null
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Még nincs alapanyag a készletben. A <b>Készlet → Új tétel</b> űrlapon vedd fel
        „Alapanyag" típussal — a neve egyezzen a termékek Anyag mezőjével (pl. „Z410"),
        és a rendszer a lövésszámokból automatikusan számolja a fogyást.
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h3 className="font-semibold">{title}</h3>}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        {statuses.map((s) => {
          const negative = s.estimatedKg <= 0
          const stocktakeDays = daysSince(s.lastStocktakeAt)
          return (
            <Card key={s.item.id} className={`p-3.5 ${negative ? 'border-destructive/60' : ''}`}>
              <div className="flex items-start gap-2.5">
                <Cube className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" weight="duotone" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <b className="truncate">{s.item.productName}</b>
                    {s.matchedProductCount > 0 ? (
                      <Badge variant="outline" className="text-[10px]">{s.matchedProductCount} termék</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-warning-foreground border-warning">
                        nincs párosított termék
                      </Badge>
                    )}
                  </div>
                  <div className={`text-2xl font-bold font-mono tabular-nums ${negative ? 'text-destructive' : ''}`}>
                    ~{fmtKg(s.estimatedKg)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    könyvelt: {fmtKg(s.bookedKg)}
                    {s.unbookedConsumptionKg > 0 && <> · azóta gépi fogyás: −{fmtKg(s.unbookedConsumptionKg)}</>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    {stocktakeDays === null ? (
                      <><Warning className="w-3.5 h-3.5 text-warning" weight="fill" /> még nem volt leltár</>
                    ) : (
                      <>utolsó leltár: {stocktakeDays === 0 ? 'ma' : `${stocktakeDays} napja`}</>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                <Button size="sm" variant="outline" className="gap-1 h-8 coarse:h-10" onClick={() => setAction({ status: s, kind: 'bevet' })}>
                  <Plus className="w-3.5 h-3.5" /> Bevét
                </Button>
                <Button size="sm" variant="outline" className="gap-1 h-8 coarse:h-10" onClick={() => setAction({ status: s, kind: 'visszaolvasztas' })}>
                  <Recycle className="w-3.5 h-3.5" /> Visszaolvasztás
                </Button>
                <Button size="sm" variant="outline" className="gap-1 h-8 coarse:h-10" onClick={() => setAction({ status: s, kind: 'leltar' })}>
                  <Scales className="w-3.5 h-3.5" /> Leltár
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <MaterialActionDialog
        key={action ? `${action.status.item.id}-${action.kind}` : 'none'}
        action={action}
        onClose={() => setAction(null)}
        onConfirm={(kg) => {
          if (!action) return
          const result = buildMaterialAction(action.status.item, action.kind, kg, auth.user?.id)
          onApply({ ...result, kind: action.kind })
          if (action.kind === 'leltar') {
            // A leltár az új viszonyítási pont: a mai napig „könyveltnek"
            // tekintjük, a becslés tiszta lappal indul.
            const today = new Date()
            const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
            setBookedThrough({ ...bookedThrough, [action.status.item.id]: iso })
            const d = result.diffKg ?? 0
            toast.success(`Leltár rögzítve: ${kg} kg (eltérés: ${d > 0 ? '+' : ''}${d} kg)`)
          } else {
            toast.success(`${MATERIAL_ACTION_LABEL[action.kind]}: +${kg} kg`)
          }
          setAction(null)
        }}
      />
    </div>
  )
}

// ─── Művelet-dialógus (bevét / visszaolvasztás / leltár) ────────────────────

function MaterialActionDialog({
  action,
  onClose,
  onConfirm,
}: {
  action: { status: MaterialStatus; kind: MaterialActionKind } | null
  onClose: () => void
  onConfirm: (kg: number) => void
}) {
  const [value, setValue] = useState('')
  if (!action) return null
  const { status, kind } = action
  const kg = parseFloatSafe(value, 0, { allowNegative: false })
  const valid = kind === 'leltar' ? value.trim() !== '' && kg >= 0 : kg > 0

  const description =
    kind === 'bevet'
      ? 'Mennyi anyag érkezett? A könyvelt készlethez hozzáadódik.'
      : kind === 'visszaolvasztas'
        ? 'Mennyi anyagot olvasztottatok vissza (beömlők, selejt)? A készlethez hozzáadódik.'
        : `Mérd le a tényleges készletet — ez lesz az új kiindulópont. Könyvelt: ${status.bookedKg} kg, becsült: ~${status.estimatedKg} kg.`

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {kind === 'bevet' ? <Plus className="w-5 h-5 text-primary" /> :
             kind === 'visszaolvasztas' ? <Recycle className="w-5 h-5 text-emerald-600" /> :
             <Scales className="w-5 h-5 text-primary" />}
            {MATERIAL_ACTION_LABEL[kind]} — {status.item.productName}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-1">
          <Label htmlFor="material-kg">{kind === 'leltar' ? 'Mért készlet (kg)' : 'Mennyiség (kg)'}</Label>
          <Input
            id="material-kg"
            type="number"
            min={0}
            step="0.1"
            inputMode="decimal"
            autoFocus
            value={value}
            placeholder="pl. 250"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && valid) onConfirm(kg) }}
            className="text-xl font-mono h-12"
          />
          {kind === 'leltar' && value.trim() !== '' && (
            <p className="text-xs text-muted-foreground">
              Eltérés a könyvelthez képest: {(Math.round((kg - status.bookedKg) * 10) / 10).toLocaleString('hu-HU')} kg
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button disabled={!valid} onClick={() => onConfirm(kg)} className="gap-1">
            <CheckCircle className="w-4 h-4" weight="fill" /> Rögzítés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
