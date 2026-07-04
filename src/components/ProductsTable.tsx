import { Product, Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { PencilSimple, Trash, Package, ClockCounterClockwise, Copy, X } from '@phosphor-icons/react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { memo, useMemo, useState } from 'react'
import { EntityHistoryDialog } from '@/components/EntityHistoryDialog'

interface SavedTemplateRef {
  id: string
  name: string
  data: { type: string; active?: boolean }
}

interface ProductsTableProps {
  products: Product[]
  orders: Order[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  savedTemplates?: SavedTemplateRef[]
  /**
   * Opcionális tömeges törlés. Ha nincs megadva, a `onDelete` hívódik meg
   * soronként, ami szintén működőképes, csak több tost-üzenetet produkál.
   */
  onBulkDelete?: (ids: string[]) => void
}

/**
 * Két termék "duplikátum" akkor, ha ügyfél + rajzszám + megnevezés mindhárom
 * (normalizált) mezőben megegyezik. Üres rajzszám esetén csak ügyfél + megnevezés
 * alapján párosítunk, hogy a hibás importból származó ismétlések is elkaphatók legyenek.
 */
function duplicateKey(p: Product): string {
  const norm = (s: string | undefined | null) =>
    (s ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ')
  return [norm(p.customer), norm(p.drawingNumber), norm(p.productName)].join('||')
}

function ProductsTableImpl({ products, orders, onEdit, onDelete, onBulkDelete, savedTemplates }: ProductsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  // Csak azok az ID-k számítanak kijelöltnek, amik a jelenleg látható listában is benne vannak.
  const visibleSelected = useMemo(
    () => selectedIds.filter((id) => products.some((p) => p.id === id)),
    [selectedIds, products]
  )

  // Címkesablon-térkép egyszer, hogy soronként ne O(n) find fusson.
  const templateById = useMemo(
    () => new Map((savedTemplates || []).map((t) => [t.id, t])),
    [savedTemplates]
  )

  const allVisibleSelected = products.length > 0 && visibleSelected.length === products.length
  const someVisibleSelected = visibleSelected.length > 0 && !allVisibleSelected

  // Duplikátum-csoportok detektálása a látható listán.
  const duplicateGroups = useMemo(() => {
    const groups = new Map<string, Product[]>()
    for (const p of products) {
      const key = duplicateKey(p)
      if (!key.replace(/\|/g, '').trim()) continue // teljesen üres → kihagyjuk
      const arr = groups.get(key) ?? []
      arr.push(p)
      groups.set(key, arr)
    }
    // Csak azokat a csoportokat tartjuk meg, ahol >1 elem van
    return Array.from(groups.values()).filter((arr) => arr.length > 1)
  }, [products])

  const duplicateIdSet = useMemo(() => {
    const s = new Set<string>()
    for (const g of duplicateGroups) for (const p of g) s.add(p.id)
    return s
  }, [duplicateGroups])

  // A "törölendő duplikátumok": minden csoportból az első megmarad, a többi kijelölhető.
  const duplicateDeleteCandidates = useMemo(() => {
    const ids: string[] = []
    for (const g of duplicateGroups) {
      // Az első (eredetileg listán szereplő) marad — a többit jelöljük ki.
      for (let i = 1; i < g.length; i++) ids.push(g[i].id)
    }
    return ids
  }, [duplicateGroups])

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (productToDelete) {
      onDelete(productToDelete)
      setProductToDelete(null)
      // Ha a sor egyben ki volt jelölve, vegyük le a kijelölésből is.
      setSelectedIds((prev) => prev.filter((id) => id !== productToDelete))
    }
    setDeleteDialogOpen(false)
  }

  const handleConfirmBulkDelete = () => {
    const ids = [...visibleSelected]
    if (ids.length === 0) {
      setBulkDeleteDialogOpen(false)
      return
    }
    if (onBulkDelete) {
      onBulkDelete(ids)
    } else {
      // Fallback: soronkénti törlés.
      for (const id of ids) onDelete(id)
    }
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
    setBulkDeleteDialogOpen(false)
  }

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(id) ? prev : [...prev, id]
      }
      return prev.filter((x) => x !== id)
    })
  }

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...products.map((p) => p.id)])))
    } else {
      const visibleIds = new Set(products.map((p) => p.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)))
    }
  }

  const selectAllDuplicates = () => {
    if (duplicateDeleteCandidates.length === 0) return
    setSelectedIds((prev) => Array.from(new Set([...prev, ...duplicateDeleteCandidates])))
  }

  const clearSelection = () => setSelectedIds([])

  const handleViewHistory = (product: Product) => {
    setSelectedProduct(product)
    setHistoryDialogOpen(true)
  }

  const getProductOrders = (product: Product) => {
    return orders.filter(o =>
      (o.productName === product.productName || o.productName === product.drawingNumber) &&
      o.customer === product.customer
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Package className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
        <h3 className="text-xl font-semibold mb-2">Nincs termék</h3>
        <p className="text-muted-foreground max-w-md">
          Kezdje el az új termék létrehozásával
        </p>
      </div>
    )
  }

  return (
    <>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="font-mono">
            Összesen: {products.length} termék
          </Badge>
          {duplicateDeleteCandidates.length > 0 && (
            <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning-foreground">
              <Copy className="w-3 h-3 mr-1" weight="bold" />
              {duplicateDeleteCandidates.length} lehetséges duplikátum
            </Badge>
          )}
          {visibleSelected.length > 0 && (
            <Badge variant="default" className="font-mono">
              Kijelölve: {visibleSelected.length}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {duplicateDeleteCandidates.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={selectAllDuplicates}
              className="border-warning/50"
              title="Minden duplikátum-csoportból az első kivételével kijelöli a többit"
            >
              <Copy className="w-4 h-4 mr-1" weight="bold" />
              Duplikátumok kijelölése
            </Button>
          )}
          {visibleSelected.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="w-4 h-4 mr-1" />
                Kijelölés törlése
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash className="w-4 h-4 mr-1" />
                Kijelöltek törlése ({visibleSelected.length})
              </Button>
            </>
          )}
        </div>
      </div>

      <Card className="w-full">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px] sticky left-0 bg-card z-10">
                    <Checkbox
                      checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={(v) => toggleAllVisible(v === true)}
                      aria-label="Minden sor kijelölése"
                    />
                  </TableHead>
                  <TableHead className="min-w-[150px]">Ügyfél</TableHead>
                  <TableHead className="min-w-[150px]">Termék rajzszáma</TableHead>
                  <TableHead className="min-w-[200px]">Termék megnevezés</TableHead>
                  <TableHead className="min-w-[200px]">Megjegyzés</TableHead>
                  <TableHead className="min-w-[120px]">Fészekszáma</TableHead>
                  <TableHead className="min-w-[100px]">Súly/db</TableHead>
                  <TableHead className="min-w-[120px]">Anyag</TableHead>
                  <TableHead className="min-w-[150px]">Felületkezelés</TableHead>
                  <TableHead className="min-w-[120px]">Ciklus idő</TableHead>
                  <TableHead className="min-w-[130px]">Utómunka idő</TableHead>
                  <TableHead className="min-w-[150px]">Utómunkák</TableHead>
                  <TableHead className="min-w-[120px]">Doboz méret</TableHead>
                  <TableHead className="min-w-[100px]">Doboz/db</TableHead>
                  <TableHead className="min-w-[130px]">Doboz/Raklap</TableHead>
                  <TableHead className="min-w-[120px]">Arktikál nr.</TableHead>
                  <TableHead className="min-w-[100px]">Raktár</TableHead>
                  <TableHead className="min-w-[120px]">Engusz súly</TableHead>
                  <TableHead className="min-w-[160px]">Etikett</TableHead>
                  <TableHead className="text-right min-w-[120px] sticky right-0 bg-card">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => {
                  const isSelected = selectedIds.includes(product.id)
                  const isDuplicate = duplicateIdSet.has(product.id)
                  const rowCls = [
                    isSelected
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]',
                  ].join(' ')
                  return (
                    <TableRow key={product.id} className={rowCls} data-state={isSelected ? 'selected' : undefined}>
                      <TableCell className="w-[44px] sticky left-0 bg-inherit z-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(v) => toggleOne(product.id, v === true)}
                          aria-label={`${product.productName} kijelölése`}
                        />
                      </TableCell>
                      <TableCell className="font-medium min-w-[150px]">
                        <div className="flex items-center gap-2">
                          {product.customer}
                          {isDuplicate && (
                            <Badge
                              variant="outline"
                              className="border-warning/50 bg-warning/10 text-xs py-0 h-5"
                              title="Duplikátum: ügyfél + rajzszám + megnevezés alapján egyezik"
                            >
                              dup
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono min-w-[150px]">{product.drawingNumber}</TableCell>
                      <TableCell className="min-w-[200px]">{product.productName}</TableCell>
                      <TableCell className="min-w-[200px]">{product.notes}</TableCell>
                      <TableCell className="min-w-[120px]">{product.nestCount}</TableCell>
                      <TableCell className="min-w-[100px]">{product.weightPerPiece}</TableCell>
                      <TableCell className="min-w-[120px]">{product.material}</TableCell>
                      <TableCell className="min-w-[150px]">{product.surfaceTreatment}</TableCell>
                      <TableCell className="min-w-[120px]">{product.cycleTime}</TableCell>
                      <TableCell className="min-w-[130px]">{product.postProcessingTime}</TableCell>
                      <TableCell className="min-w-[150px]">{product.postProcessing}</TableCell>
                      <TableCell className="min-w-[120px]">{product.boxSize}</TableCell>
                      <TableCell className="min-w-[100px]">{product.piecesPerBox}</TableCell>
                      <TableCell className="min-w-[130px]">{product.boxesPerPallet}</TableCell>
                      <TableCell className="font-mono min-w-[120px]">{product.articleNumber}</TableCell>
                      <TableCell className="min-w-[100px]">{product.warehouse}</TableCell>
                      <TableCell className="min-w-[120px]">{product.spruWeight}</TableCell>
                      <TableCell className="min-w-[160px]">
                        {product.labelTemplateId && (() => {
                          const tpl = templateById.get(product.labelTemplateId)
                          return tpl ? (
                            <Badge variant="outline" className="text-xs font-normal max-w-[150px] truncate" title={tpl.name}>
                              {tpl.name}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">törölt sablon</span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="text-right min-w-[120px] sticky right-0 bg-card">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewHistory(product)}
                            title="Rendelési előzmények"
                          >
                            <ClockCounterClockwise className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(product.id)}
                          >
                            <PencilSimple className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(product.id)}
                          >
                            <Trash className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törli a terméket?</AlertDialogTitle>
            <AlertDialogDescription>
              Ez a művelet nem visszavonható. A termék véglegesen törlésre kerül.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductToDelete(null)}>
              Mégse
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Biztosan törli a kijelölt {visibleSelected.length} terméket?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ez a művelet nem visszavonható. A kijelölt termékek véglegesen törlésre kerülnek.
              {' '}A termékekhez tartozó rendelések és készletadatok érintetlenek maradnak, csak a
              törzsadat (termék bejegyzés) tűnik el.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Mégse</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkDelete}>
              {visibleSelected.length} termék törlése
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedProduct && (
        <EntityHistoryDialog
          open={historyDialogOpen}
          onClose={() => setHistoryDialogOpen(false)}
          entityName={`${selectedProduct.productName} (${selectedProduct.customer})`}
          entityType="product"
          relatedOrders={getProductOrders(selectedProduct)}
        />
      )}
    </>
  )
}

export const ProductsTable = memo(ProductsTableImpl)
