import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ValidationResult } from '@/lib/exportValidation'
import { Order } from '@/lib/types'
import { Warning, X, CheckCircle, PencilSimple } from '@phosphor-icons/react'

interface ValidationDialogProps {
  open: boolean
  onClose: () => void
  onContinue: () => void
  validation: ValidationResult
  title: string
  orders?: Order[]
  onEditOrder?: (orderId: string) => void
  onEditSettings?: () => void
  exportType?: 'cmr' | 'delivery'
}

export function ValidationDialog({ 
  open, 
  onClose, 
  onContinue, 
  validation, 
  title,
  orders = [],
  onEditOrder,
  onEditSettings,
  exportType
}: ValidationDialogProps) {
  const hasErrors = validation.errors.length > 0
  const hasWarnings = validation.warnings.length > 0

  const handleEditClick = (error: typeof validation.errors[0]) => {
    if (error.orderId && onEditOrder) {
      onEditOrder(error.orderId)
      onClose()
    } else if (error.field.startsWith('cmrSettings') && onEditSettings && exportType === 'cmr') {
      onEditSettings()
      onClose()
    }
  }

  const canEdit = (error: typeof validation.errors[0]) => {
    if (error.orderId && onEditOrder) return true
    if (error.field.startsWith('cmrSettings') && onEditSettings && exportType === 'cmr') return true
    return false
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <X className="w-5 h-5 text-destructive" weight="fill" />
            ) : hasWarnings ? (
              <Warning className="w-5 h-5 text-warning" weight="fill" />
            ) : (
              <CheckCircle className="w-5 h-5 text-success" weight="fill" />
            )}
            {title}
          </DialogTitle>
          <DialogDescription>
            {hasErrors
              ? 'Hibákat találtunk az exportálás előtt. Javítsa a hibákat a folytatáshoz.'
              : hasWarnings
              ? 'Figyelmeztetéseket találtunk. Folytathatja az exportálást, de ellenőrizze az adatokat.'
              : 'Minden adat rendben van. Folytathatja az exportálást.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {validation.errors.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <X className="w-4 h-4" weight="fill" />
                  Hibák ({validation.errors.length})
                </h3>
                {validation.errors.map((error, idx) => (
                  <Alert key={idx} variant="destructive">
                    <AlertDescription className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-medium">{error.field}:</span> {error.message}
                        {error.orderIndex !== undefined && (
                          <span className="text-xs ml-2 opacity-80">
                            (Rendelés #{error.orderIndex + 1})
                          </span>
                        )}
                      </div>
                      {canEdit(error) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(error)}
                          className="gap-1 shrink-0 h-7 text-xs"
                        >
                          <PencilSimple className="w-3 h-3" />
                          Javítás
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-warning flex items-center gap-2">
                  <Warning className="w-4 h-4" weight="fill" />
                  Figyelmeztetések ({validation.warnings.length})
                </h3>
                {validation.warnings.map((warning, idx) => (
                  <Alert key={idx} className="border-warning/50 bg-warning/5">
                    <AlertDescription className="text-warning-foreground flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span className="font-medium">{warning.field}:</span> {warning.message}
                        {warning.orderIndex !== undefined && (
                          <span className="text-xs ml-2 opacity-80">
                            (Rendelés #{warning.orderIndex + 1})
                          </span>
                        )}
                      </div>
                      {canEdit(warning) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditClick(warning)}
                          className="gap-1 shrink-0 h-7 text-xs"
                        >
                          <PencilSimple className="w-3 h-3" />
                          Javítás
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {!hasErrors && !hasWarnings && (
              <Alert className="border-success/50 bg-success/5">
                <CheckCircle className="w-4 h-4 text-success" weight="fill" />
                <AlertDescription className="text-success-foreground">
                  Minden mező kitöltve és érvényes.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          {!hasErrors && (
            <Button onClick={onContinue} className="gap-2">
              {hasWarnings ? 'Folytatás mindenképp' : 'Exportálás'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
