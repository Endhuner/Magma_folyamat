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
  /** Felhasználói művelet megnevezése: 'szállítólevél' / 'CMR' / 'státuszváltás'. */
  context?: string
}

export function InventoryDeductionDialog({
  open,
  onClose,
  onConfirm,
  deductionResult,
  context,
}: InventoryDeductionDialogProps) {
  if (!deductionResult) return null

  const hasFailures = deductionResult.failedItems.length > 0
  const hasShortages = deductionResult.deductedItems.some((d) => d.shortage > 0)
  const hasWarnings = hasFailures || hasShortages
  const label = context || 'művelet'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Készlet csökkentés megerősítése</DialogTitle>
          <DialogDescription>
            {hasWarnings
              ? `Figyelmeztetés: nem minden mennyiség fedezett a készletből (${label}).`
              : `A ${label} kiállítása automatikusan csökkenti a készletet.`}
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
                  {deductionResult.deductedItems.map((item, idx) => {
                    const partial = item.shortage > 0
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          partial
                            ? 'bg-warning/10 border-warning/30'
                            : 'bg-success/10 border-success/20'
                        }`}
                      >
                        <div>
                          <div className="font-medium">{item.productName}</div>
                          <div className="text-sm text-muted-foreground">
                            Rajzszám: {item.drawingNumber}
                          </div>
                          {partial && (
                            <div className="text-xs text-warning-foreground mt-1">
                              Részleges levonás: {item.deductedQuantity} / {item.requiredQuantity} db —
                              hiány: <span className="font-mono">{item.shortage} db</span>
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`font-mono ${partial ? 'border-warning/60 bg-warning/20' : ''}`}
                        >
                          -{item.deductedQuantity} db
                        </Badge>
                      </div>
                    )
                  })}
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
                    Ezeket a tételeket nem tudjuk levonni a készletről. A {label} kiállítása a
                    felhasználó döntésétől függően mégis folytatódhat.
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
            variant={hasWarnings ? 'destructive' : 'default'}
          >
            {hasWarnings ? 'Folytatás figyelmeztetéssel' : 'Megerősítés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
