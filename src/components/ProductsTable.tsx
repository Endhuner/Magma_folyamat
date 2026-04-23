import { Product, Order } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { PencilSimple, Trash, Package, ClockCounterClockwise } from '@phosphor-icons/react'
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
import { useState } from 'react'
import { EntityHistoryDialog } from '@/components/EntityHistoryDialog'

interface ProductsTableProps {
  products: Product[]
  orders: Order[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function ProductsTable({ products, orders, onEdit, onDelete }: ProductsTableProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<string | null>(null)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const handleDeleteClick = (id: string) => {
    setProductToDelete(id)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = () => {
    if (productToDelete) {
      onDelete(productToDelete)
      setProductToDelete(null)
    }
    setDeleteDialogOpen(false)
  }

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
      <div className="bg-muted/50 border border-accent/30 rounded-lg p-3 mb-3">
        <h4 className="text-xs font-semibold text-muted-foreground mb-2">📋 Gyors referencia - Sablon változók (Termékek):</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs font-mono">
          <div><span className="text-accent font-semibold">{'{{productCustomer}}'}</span> - Ügyfél</div>
          <div><span className="text-accent font-semibold">{'{{drawingNumber}}'}</span> - Termék rajzszáma</div>
          <div><span className="text-accent font-semibold">{'{{productName}}'}</span> - Termék megnevezés</div>
          <div><span className="text-accent font-semibold">{'{{productNotes}}'}</span> - Megjegyzés</div>
          <div><span className="text-accent font-semibold">{'{{nestCount}}'}</span> - Fészekszáma</div>
          <div><span className="text-accent font-semibold">{'{{weightPerPiece}}'}</span> - Súly/db</div>
          <div><span className="text-accent font-semibold">{'{{material}}'}</span> - Anyag</div>
          <div><span className="text-accent font-semibold">{'{{surfaceTreatment}}'}</span> - Felületkezelés</div>
          <div><span className="text-accent font-semibold">{'{{cycleTime}}'}</span> - Ciklus idő</div>
          <div><span className="text-accent font-semibold">{'{{postWorkTime}}'}</span> - Utómunka idő</div>
          <div><span className="text-accent font-semibold">{'{{postWork}}'}</span> - Utómunkák</div>
          <div><span className="text-accent font-semibold">{'{{boxSize}}'}</span> - Doboz méret</div>
          <div><span className="text-accent font-semibold">{'{{piecesPerBox}}'}</span> - Doboz/db</div>
          <div><span className="text-accent font-semibold">{'{{boxesPerPallet}}'}</span> - Doboz/Raklap</div>
          <div><span className="text-accent font-semibold">{'{{articleNumber}}'}</span> - Arktikál nr.</div>
          <div><span className="text-accent font-semibold">{'{{warehouse}}'}</span> - Raktár</div>
          <div><span className="text-accent font-semibold">{'{{spureWeight}}'}</span> - Engusz súly</div>
        </div>
      </div>

      <Card className="w-full">
        <ScrollArea className="w-full">
          <div className="min-w-max">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableHead className="text-right min-w-[120px] sticky right-0 bg-card">Műveletek</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product, index) => (
                  <TableRow key={product.id} className="even:bg-[oklch(0.94_0.015_250)] hover:bg-[oklch(0.88_0.02_250)]">
                    <TableCell className="font-medium min-w-[150px]">{product.customer}</TableCell>
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
                ))}
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
