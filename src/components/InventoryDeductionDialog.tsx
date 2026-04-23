import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { InventoryDeductionResult } from '@/lib/inventoryService'

interface InventoryDeductionDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  deductionResult: InventoryDeductionResult | null
}

export function InventoryDeductionDialog({
  open,
  onClose,
  onConfirm,
  deductionResult
}: InventoryDeductionDialogProps) {
  if (!deductionResult) return null

  const hasFailures = deductionResult.failedItems.length > 0

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Készlet csökkentés megerősítése</DialogTitle>
          <DialogDescription>
            {hasFailures 
              ? 'Figyelmeztetés: Nem minden termék vonható le a készletből'
              : 'A rendelések teljesítése automatikusan csökkenteni fogja a készletet'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {deductionResult.deductedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-success">
                  <CheckCircle className="w-5 h-5" weight="fill" />
                  <span>Sikeresen levonható tételek ({deductionResult.deductedItems.length})</span>
                </div>
                <div className="space-y-2">
                  {deductionResult.deductedItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
                      <div>
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-sm text-muted-foreground">
                          Rajzszám: {item.drawingNumber}
                        </div>
                      </div>
                      <Badge variant="outline" className="font-mono">
                        -{item.deductedQuantity} db
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deductionResult.failedItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 font-semibold text-destructive">
                  <WarningCircle className="w-5 h-5" weight="fill" />
                  <span>Problémás tételek ({deductionResult.failedItems.length})</span>
                </div>
                <Alert variant="destructive">
                  <AlertDescription>
                    Ezek a tételek nem kerülnek levonásra. A rendelések státusza mégis megváltozik.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  {deductionResult.failedItems.map((item, idx) => (
                    <div key={idx} className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{item.productName}</div>
                        <Badge variant="destructive">Hiba</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Rajzszám: {item.drawingNumber}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Szükséges:</span>{' '}
                        <span className="font-mono">{item.requiredQuantity} db</span>
                        {' | '}
                        <span className="text-muted-foreground">Elérhető:</span>{' '}
                        <span className="font-mono">{item.availableQuantity} db</span>
                      </div>
                      <div className="text-sm text-destructive">
                        {item.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button 
            onClick={onConfirm}
            variant={hasFailures ? 'destructive' : 'default'}
          >
            {hasFailures ? 'Folytatás figyelmeztetéssel' : 'Készlet csökkentése'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
