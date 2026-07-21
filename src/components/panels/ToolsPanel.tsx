/**
 * Eszközlista panel (Készlet → Eszközlista).
 *
 * Miért nem SimpleListView? Az eszközhöz több beszerzési hely tartozhat, és
 * mindegyiknek saját webcíme/emailje/elérhetősége van. A SimpleListView
 * form-state-je viszont lapos `Record<string, string>` — beágyazott listát nem
 * tud kezelni, és a ~10 másik oldal miatt nem akartuk átszabni. Ezért ez a
 * panel önálló, de vizuálisan pontosan követi a SimpleListView-t.
 */
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, PencilSimple, Trash, MagnifyingGlass, Wrench } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { generateId } from '@/lib/generateId'
import { stripDiacritics } from '@/lib/helpers'
import type { Tool, ToolSupplier, ToolUnit } from '@/lib/types'

/** Választható mértékegységek. */
const UNITS: ToolUnit[] = ['db', 'kg']

export interface ToolsPanelProps {
  tools: Tool[]
  onSave: (tool: Tool) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  /** Ha false-t ad, a törlés gomb rejtve (pl. operátor nem törölhet). */
  canDelete?: boolean
}

/** Üres beszerzési hely — az "+ Beszerzési hely" gomb ezt adja hozzá. */
const emptySupplier = (): ToolSupplier => ({ name: '', website: '', email: '', contact: '' })

/**
 * A beszerzési helyek MINDIG tömbként. A backend JSON-deszerializálója sérült
 * mezőnél objektumot ({}) is visszaadhat — a `?? []` ezt nem fogná meg, és a
 * `.map()` renderelés közben dobna TypeError-t (fehér képernyő).
 */
const supOf = (t: Tool): ToolSupplier[] => (Array.isArray(t.suppliers) ? t.suppliers : [])

interface Draft {
  partNumber: string
  name: string
  manufacturer: string
  size: string
  location: string
  stock: string
  unit: ToolUnit
  price: string
  purchasePrice: string
  purchasedAt: string
  suppliers: ToolSupplier[]
}

const emptyDraft = (): Draft => ({
  partNumber: '', name: '', manufacturer: '', size: '', location: '',
  stock: '', unit: 'db', price: '', purchasePrice: '', purchasedAt: '', suppliers: [],
})

/** "12,5" és "12.5" is elfogadott; üres → 0. */
function parseNum(raw: string): number {
  const n = Number.parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

const fmtNum = (n: number) => n.toLocaleString('hu-HU', { maximumFractionDigits: 2 })

/** Csak akkor csinálunk linket, ha tényleg van mit megnyitni. */
function webHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

export function ToolsPanel({ tools, onSave, onDelete, canDelete = true }: ToolsPanelProps) {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const filtered = useMemo(() => {
    const q = stripDiacritics(search)
    if (!q) return tools
    return tools.filter((t) => {
      const hay = [
        t.partNumber, t.name, t.manufacturer, t.size, t.location,
        ...supOf(t).flatMap((s) => [s.name, s.website, s.email, s.contact]),
      ].join(' ')
      return stripDiacritics(hay).includes(q)
    })
  }, [tools, search])

  const openAdd = () => {
    setDraft(emptyDraft())
    setEditingId(null)
    setDialogOpen(true)
  }

  const openEdit = (t: Tool) => {
    setDraft({
      partNumber: t.partNumber ?? '',
      name: t.name ?? '',
      manufacturer: t.manufacturer ?? '',
      size: t.size ?? '',
      location: t.location ?? '',
      stock: t.stock != null ? String(t.stock) : '',
      unit: UNITS.includes(t.unit) ? t.unit : 'db',
      price: t.price != null ? String(t.price) : '',
      purchasePrice: t.purchasePrice != null ? String(t.purchasePrice) : '',
      purchasedAt: t.purchasedAt ?? '',
      // másolat, hogy a dialógusbeli szerkesztés ne írja a listát mentés előtt
      suppliers: supOf(t).map((s) => ({ ...s })),
    })
    setEditingId(t.id)
    setDialogOpen(true)
  }

  const patchSupplier = (idx: number, key: keyof ToolSupplier, value: string) => {
    setDraft((d) => ({
      ...d,
      suppliers: d.suppliers.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    }))
  }

  const handleSave = async () => {
    if (saving) return
    if (!draft.name.trim()) {
      toast.error('A "Termék megnevezése" kitöltése kötelező')
      return
    }
    const now = new Date().toISOString()
    const existing = editingId ? tools.find((t) => t.id === editingId) : undefined
    const record: Tool = {
      id: editingId ?? generateId(),
      partNumber: draft.partNumber.trim(),
      name: draft.name.trim(),
      manufacturer: draft.manufacturer.trim(),
      size: draft.size.trim(),
      location: draft.location.trim(),
      stock: parseNum(draft.stock),
      unit: draft.unit,
      price: parseNum(draft.price),
      purchasePrice: parseNum(draft.purchasePrice),
      purchasedAt: draft.purchasedAt,
      // a teljesen üres sorokat nem mentjük
      suppliers: draft.suppliers
        .map((s) => ({
          name: s.name.trim(),
          website: s.website.trim(),
          email: s.email.trim(),
          contact: s.contact.trim(),
        }))
        .filter((s) => s.name || s.website || s.email || s.contact),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    setSaving(true)
    try {
      await Promise.resolve(onSave(record))
      toast.success(editingId ? 'Eszköz módosítva' : 'Eszköz hozzáadva')
      setDialogOpen(false)
      setEditingId(null)
    } catch {
      // a hívó tósztol; a dialógust nyitva hagyjuk, hogy ne vesszen el a bevitel
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId || deleting) return
    setDeleting(true)
    try {
      await Promise.resolve(onDelete(deleteId))
      toast.success('Eszköz törölve')
    } catch {
      // hívó tósztol
    } finally {
      setDeleting(false)
      setDeleteId(null)
    }
  }

  const isEmpty = tools.length === 0
  const noHits = !isEmpty && filtered.length === 0

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Eszközlista</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Szerszámok és eszközök készlete, ára és beszerzési helyei
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <MagnifyingGlass
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              weight="bold"
            />
            <Input
              placeholder="Keresés..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-full md:w-64"
            />
          </div>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" weight="bold" />
            Új eszköz
          </Button>
        </div>
      </div>

      {isEmpty ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center border-dashed">
          <Wrench className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
          <h3 className="text-xl font-semibold mb-2">Még nincs eszköz</h3>
          <p className="text-muted-foreground max-w-md mb-4">
            Vegye fel az első eszközt az „Új eszköz” gombbal.
          </p>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" weight="bold" />
            Új eszköz
          </Button>
        </Card>
      ) : (
        <Card className="w-full">
          <ScrollArea className="w-full">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead style={{ minWidth: 120 }}>Cikkszám</TableHead>
                    <TableHead style={{ minWidth: 200 }}>Termék megnevezése</TableHead>
                    <TableHead style={{ minWidth: 140 }}>Gyártó</TableHead>
                    <TableHead style={{ minWidth: 110 }}>Méret</TableHead>
                    <TableHead style={{ minWidth: 130 }}>Elhelyezés</TableHead>
                    <TableHead className="text-right" style={{ minWidth: 110 }}>Készlet</TableHead>
                    <TableHead className="text-right" style={{ minWidth: 100 }}>Ár</TableHead>
                    <TableHead className="text-right" style={{ minWidth: 120 }}>Beszerzési ár</TableHead>
                    <TableHead style={{ minWidth: 130 }}>Beszerzés ideje</TableHead>
                    <TableHead style={{ minWidth: 280 }}>Beszerzési helyek</TableHead>
                    <TableHead className="text-right min-w-[120px] sticky right-0 bg-card">
                      Műveletek
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noHits ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-10">
                        Nincs találat a keresésre.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-sm">
                          {t.partNumber || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          {t.manufacturer || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell>
                          {t.size || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell>
                          {t.location || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono whitespace-nowrap">
                          {fmtNum(t.stock ?? 0)} <span className="text-muted-foreground">{t.unit || 'db'}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(t.price ?? 0)}</TableCell>
                        <TableCell className="text-right font-mono">{fmtNum(t.purchasePrice ?? 0)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {t.purchasedAt || <span className="text-muted-foreground/60">—</span>}
                        </TableCell>
                        <TableCell>
                          {supOf(t).length === 0 ? (
                            <span className="text-muted-foreground/60">—</span>
                          ) : (
                            <div className="space-y-1">
                              {supOf(t).map((s, i) => (
                                <div key={i} className="text-sm leading-tight">
                                  <span className="font-medium">
                                    {s.name || <span className="text-muted-foreground/60">(névtelen)</span>}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {s.website && (
                                      <>
                                        {' · '}
                                        <a
                                          href={webHref(s.website)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="underline hover:text-foreground"
                                        >
                                          {s.website}
                                        </a>
                                      </>
                                    )}
                                    {s.email && (
                                      <>
                                        {' · '}
                                        <a
                                          href={`mailto:${s.email}`}
                                          className="underline hover:text-foreground"
                                        >
                                          {s.email}
                                        </a>
                                      </>
                                    )}
                                    {s.contact && <> {' · '}{s.contact}</>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right sticky right-0 bg-card">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(t)}
                              aria-label="Szerkesztés"
                            >
                              <PencilSimple className="w-4 h-4" />
                            </Button>
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(t.id)}
                                aria-label="Törlés"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Eszköz szerkesztése' : 'Új eszköz'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div>
              <Label htmlFor="tool-partnumber" className="mb-1.5 block">Cikkszám</Label>
              <Input
                id="tool-partnumber"
                value={draft.partNumber}
                onChange={(e) => setDraft((d) => ({ ...d, partNumber: e.target.value }))}
                placeholder="pl. GWS-125-06"
              />
            </div>
            <div>
              <Label htmlFor="tool-name" className="mb-1.5 block">
                Termék megnevezése<span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                id="tool-name"
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="pl. Sarokcsiszoló"
              />
            </div>
            <div>
              <Label htmlFor="tool-manufacturer" className="mb-1.5 block">Gyártó</Label>
              <Input
                id="tool-manufacturer"
                value={draft.manufacturer}
                onChange={(e) => setDraft((d) => ({ ...d, manufacturer: e.target.value }))}
                placeholder="pl. Bosch"
              />
            </div>
            <div>
              <Label htmlFor="tool-size" className="mb-1.5 block">Méret</Label>
              <Input
                id="tool-size"
                value={draft.size}
                onChange={(e) => setDraft((d) => ({ ...d, size: e.target.value }))}
                placeholder="pl. 125 mm"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="tool-location" className="mb-1.5 block">Elhelyezés</Label>
              <Input
                id="tool-location"
                value={draft.location}
                onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
                placeholder="pl. Szerszámkamra / B-2 polc"
              />
            </div>
            <div>
              <Label htmlFor="tool-stock" className="mb-1.5 block">Készlet</Label>
              <Input
                id="tool-stock"
                type="number"
                min={0}
                value={draft.stock}
                onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="tool-unit" className="mb-1.5 block">Egység</Label>
              <Select
                value={draft.unit}
                onValueChange={(v) => setDraft((d) => ({ ...d, unit: v as ToolUnit }))}
              >
                <SelectTrigger id="tool-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tool-price" className="mb-1.5 block">Ár</Label>
              <Input
                id="tool-price"
                type="number"
                min={0}
                value={draft.price}
                onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="tool-purchase-price" className="mb-1.5 block">Beszerzési ár</Label>
              <Input
                id="tool-purchase-price"
                type="number"
                min={0}
                value={draft.purchasePrice}
                onChange={(e) => setDraft((d) => ({ ...d, purchasePrice: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="tool-purchased-at" className="mb-1.5 block">Beszerzés ideje</Label>
              <Input
                id="tool-purchased-at"
                type="date"
                value={draft.purchasedAt}
                onChange={(e) => setDraft((d) => ({ ...d, purchasedAt: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base">Beszerzési helyek</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setDraft((d) => ({ ...d, suppliers: [...d.suppliers, emptySupplier()] }))}
              >
                <Plus className="w-4 h-4" weight="bold" />
                Beszerzési hely hozzáadása
              </Button>
            </div>

            {draft.suppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Még nincs beszerzési hely megadva. Egy eszközhöz több is felvehető.
              </p>
            ) : (
              draft.suppliers.map((s, idx) => (
                <Card key={idx} className="p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {idx + 1}. beszerzési hely
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Beszerzési hely eltávolítása"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          suppliers: d.suppliers.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <Label htmlFor={`sup-name-${idx}`} className="mb-1.5 block">Cég</Label>
                      <Input
                        id={`sup-name-${idx}`}
                        value={s.name}
                        onChange={(e) => patchSupplier(idx, 'name', e.target.value)}
                        placeholder="pl. Szerszám Kft."
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sup-web-${idx}`} className="mb-1.5 block">Webcím</Label>
                      <Input
                        id={`sup-web-${idx}`}
                        value={s.website}
                        onChange={(e) => patchSupplier(idx, 'website', e.target.value)}
                        placeholder="pl. szerszamkft.hu"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`sup-email-${idx}`} className="mb-1.5 block">Email cím</Label>
                      <Input
                        id={`sup-email-${idx}`}
                        type="email"
                        value={s.email}
                        onChange={(e) => patchSupplier(idx, 'email', e.target.value)}
                        placeholder="pl. info@szerszamkft.hu"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label htmlFor={`sup-contact-${idx}`} className="mb-1.5 block">Elérhetőség</Label>
                      <Input
                        id={`sup-contact-${idx}`}
                        value={s.contact}
                        onChange={(e) => patchSupplier(idx, 'contact', e.target.value)}
                        placeholder="pl. +36 1 234 5678 / kapcsolattartó"
                      />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Mégse
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Mentés...' : 'Mentés'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eszköz törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törli ezt az eszközt? A művelet a lomtárba helyezi a tételt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Törlés...' : 'Törlés'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
