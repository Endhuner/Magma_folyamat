import { memo, useMemo } from 'react'
import { InventoryItem, Product, Order } from '@/lib/types'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash, Package, Clock, BoxArrowDown } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

interface InventoryTableProps {
  inventory: InventoryItem[]
  products: Product[]
  orders: Order[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdjust: (id: string) => void
  onShowHistory?: (id: string) => void
  onWarehouseAdd?: (productId: string) => void
}

function InventoryTableImpl({ inventory, products, onEdit, onDelete, onAdjust, onShowHistory, onWarehouseAdd }: InventoryTableProps) {
  // Összesítők a láblécbe: teljes darabszám + hány tétel van a küszöb alatt.
  const totals = useMemo(() => {
    const totalQty = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0)
    const lowCount = inventory.filter((i) => i.quantity < 50).length
    return { totalQty, lowCount }
  }, [inventory])

  const getStockStatus = (quantity: number) => {
    if (quantity === 0) return { label: 'Nincs készleten', variant: 'destructive' as const }
    if (quantity < 50) return { label: 'Alacsony', variant: 'outline' as const }
    if (quantity < 200) return { label: 'Közepes', variant: 'secondary' as const }
    return { label: 'Megfelelő', variant: 'default' as const }
  }

  if (inventory.length === 0) {
    return (
      <Card className="p-12 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" weight="duotone" />
        <h3 className="text-lg font-semibold mb-2">Nincs készlet tétel</h3>
        <p className="text-muted-foreground">Adj hozzá új termékeket a készlethez</p>
      </Card>
    )
  }

  return (
    <>

      {/* overflow-x-auto: telefonon/tableten a sok oszlop + művelet-gomb
          a táblázaton belül görgethető, nem tolja szét a teljes oldalt. */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rajzszám</TableHead>
              <TableHead>Termék neve</TableHead>
              <TableHead>Vevő</TableHead>
              <TableHead className="text-right">Mennyiség (db)</TableHead>
              <TableHead>Státusz</TableHead>
              <TableHead>Raktár hely</TableHead>
              <TableHead>Megjegyzés</TableHead>
              <TableHead>Utolsó frissítés</TableHead>
              <TableHead className="text-right">Műveletek</TableHead>
            </TableRow>
          </TableHeader>
        <TableBody>
          {inventory.map((item, index) => {
            const status = getStockStatus(item.quantity)
            return (
              <TableRow key={item.id} className="even:bg-[var(--row-stripe)] hover:bg-[var(--row-hover)]">
                <TableCell className="font-mono text-sm">{item.drawingNumber}</TableCell>
                <TableCell className="font-medium">
                  {item.productName}
                  {item.itemType === 'szerszam' && (
                    <Badge variant="outline" className="ml-2 text-[10px] text-amber-700 dark:text-amber-300 border-amber-400">szerszám</Badge>
                  )}
                  {item.itemType === 'alapanyag' && (
                    <Badge variant="outline" className="ml-2 text-[10px] text-emerald-700 dark:text-emerald-300 border-emerald-400">alapanyag</Badge>
                  )}
                </TableCell>
                <TableCell>{item.customer}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{item.quantity}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell>{item.location || '-'}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {item.notes || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(item.lastUpdated).toLocaleDateString('hu-HU')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onWarehouseAdd && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onWarehouseAdd(item.productId)}
                        title="Raktári bevét"
                      >
                        <BoxArrowDown className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAdjust(item.id)}
                      title="Készlet korrekció"
                    >
                      <Package className="w-4 h-4" />
                    </Button>
                    {onShowHistory && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onShowHistory(item.id)}
                        title="Mozgásnapló"
                      >
                        <Clock className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(item.id)}
                      title="Szerkesztés"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(item.id)}
                      title="Törlés"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="font-semibold">
              Összesen ({inventory.length} tétel
              {totals.lowCount > 0 && <span className="text-destructive"> · {totals.lowCount} alacsony</span>})
            </TableCell>
            <TableCell className="text-right font-mono font-bold">
              {totals.totalQty.toLocaleString('hu-HU')} db
            </TableCell>
            <TableCell colSpan={5} />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
    </>
  )
}

export const InventoryTable = memo(InventoryTableImpl)
