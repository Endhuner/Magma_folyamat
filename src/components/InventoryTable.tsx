import { useState } from 'react'
import { InventoryItem, Product, Order } from '@/lib/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash, Package } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

interface InventoryTableProps {
  inventory: InventoryItem[]
  products: Product[]
  orders: Order[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onAdjust: (id: string) => void
}

export function InventoryTable({ inventory, products, onEdit, onDelete, onAdjust }: InventoryTableProps) {
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
      <div className="bg-muted/50 border border-accent/30 rounded-lg p-3 mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">📋 Gyors referencia - Sablon változók (Készlet):</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
          <div><span className="text-accent font-semibold">{'{{drawingNumber}}'}</span> - Rajzszám</div>
          <div><span className="text-accent font-semibold">{'{{productName}}'}</span> - Termék neve</div>
          <div><span className="text-accent font-semibold">{'{{customer}}'}</span> - Vevő</div>
          <div><span className="text-accent font-semibold">{'{{quantity}}'}</span> - Mennyiség (db)</div>
          <div><span className="text-accent font-semibold">{'{{location}}'}</span> - Raktár hely</div>
          <div><span className="text-accent font-semibold">{'{{notes}}'}</span> - Megjegyzés</div>
          <div><span className="text-accent font-semibold">{'{{lastUpdated}}'}</span> - Utolsó frissítés</div>
        </div>
      </div>

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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAdjust(item.id)}
                    >
                      <Package className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(item.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDelete(item.id)}
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
