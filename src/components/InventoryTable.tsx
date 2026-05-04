import { memo, useState } from 'react'
import { InventoryItem, Product, Order } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

      <div className="border rounded-lg overflow-hidden">
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
              <TableRow key={item.id} className="even:bg-[oklch(0.94_0.015_250)] hover:bg-[oklch(0.88_0.02_250)]">
                <TableCell className="font-mono text-sm">{item.drawingNumber}</TableCell>
                <TableCell className="font-medium">{item.productName}</TableCell>
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
      </Table>
    </div>
    </>
  )
}

export const InventoryTable = memo(InventoryTableImpl)
