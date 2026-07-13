import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Printer, CaretDown } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { parseIntSafe } from '@/lib/helpers'

export interface PrintSettings {
  copies: number
  printerName: string
  pageOrientation: 'portrait' | 'landscape'
  colorMode: 'color' | 'grayscale'
  paperSize: 'A4' | 'Letter'
  fitToPage: boolean
  showPrintDialog: boolean
}

interface LabelPrintSettingsDialogProps {
  open: boolean
  onClose: () => void
  onPrint: (settings: PrintSettings) => void
  defaultCopies?: number
}

export function LabelPrintSettingsDialog({
  open,
  onClose,
  onPrint,
  defaultCopies = 1
}: LabelPrintSettingsDialogProps) {
  const [copies, setCopies] = useState(defaultCopies)
  const [printerName, setPrinterName] = useState<string>('default')
  const [availablePrinters, setAvailablePrinters] = useState<string[]>(['Alapértelmezett nyomtató'])
  const [pageOrientation, setPageOrientation] = useState<'portrait' | 'landscape'>('portrait')
  const [colorMode, setColorMode] = useState<'color' | 'grayscale'>('color')
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter'>('A4')
  const [fitToPage, setFitToPage] = useState(true)
  const [showPrintDialog, setShowPrintDialog] = useState(true)

  useEffect(() => {
    if (open) {
      detectPrinters()
    }
  }, [open])

  const detectPrinters = async () => {
    try {
      const printers = ['Alapértelmezett nyomtató']
      
      if (navigator && 'mediaDevices' in navigator) {
        printers.push('Hálózati nyomtató 1', 'Hálózati nyomtató 2')
      }
      
      setAvailablePrinters(printers)
    } catch (error) {
      console.warn('Nyomtatók felismerése nem sikerült:', error)
      setAvailablePrinters(['Alapértelmezett nyomtató'])
    }
  }

  const handlePrint = () => {
    if (copies < 1) {
      toast.error('A példányszámnak legalább 1-nek kell lennie')
      return
    }

    if (copies > 100) {
      toast.warning('Nagy példányszám! Biztos folytatod?')
    }

    const settings: PrintSettings = {
      copies,
      printerName,
      pageOrientation,
      colorMode,
      paperSize,
      fitToPage,
      showPrintDialog
    }

    onPrint(settings)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-6 h-6" weight="duotone" />
            Címke Nyomtatási Beállítások
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="printer-select">Nyomtató kiválasztása</Label>
              <Select value={printerName} onValueChange={setPrinterName}>
                <SelectTrigger id="printer-select">
                  <SelectValue placeholder="Válassz nyomtatót" />
                  <CaretDown className="w-4 h-4 ml-2" />
                </SelectTrigger>
                <SelectContent>
                  {availablePrinters.map((printer, index) => (
                    <SelectItem key={index} value={printer === 'Alapértelmezett nyomtató' ? 'default' : printer}>
                      {printer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="copies">Példányszám</Label>
              <Input
                id="copies"
                type="number"
                inputMode="decimal"
                min="1"
                max="999"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, Math.min(999, parseIntSafe(e.target.value, 1, { allowNegative: false }))))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Minden címkéből {copies} példány készül
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Papír beállítások</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paper-size">Papír méret</Label>
                <Select value={paperSize} onValueChange={(value) => setPaperSize(value as 'A4' | 'Letter')}>
                  <SelectTrigger id="paper-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="Letter">Letter (216 × 279 mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="orientation">Tájolás</Label>
                <Select value={pageOrientation} onValueChange={(value) => setPageOrientation(value as 'portrait' | 'landscape')}>
                  <SelectTrigger id="orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Álló (Portrait)</SelectItem>
                    <SelectItem value="landscape">Fekvő (Landscape)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold mb-3">Nyomtatási opciók</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="color-mode">Színes nyomtatás</Label>
                  <p className="text-xs text-muted-foreground">
                    Színes vagy fekete-fehér nyomtatás
                  </p>
                </div>
                <Select value={colorMode} onValueChange={(value) => setColorMode(value as 'color' | 'grayscale')}>
                  <SelectTrigger id="color-mode" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">Színes</SelectItem>
                    <SelectItem value="grayscale">Fekete-fehér</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="fit-to-page">Oldal mérethez igazítás</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatikus átméretezés az oldalhoz
                  </p>
                </div>
                <Switch
                  id="fit-to-page"
                  checked={fitToPage}
                  onCheckedChange={setFitToPage}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-dialog">Nyomtatási párbeszéd megjelenítése</Label>
                  <p className="text-xs text-muted-foreground">
                    Beállítások módosítása nyomtatás előtt
                  </p>
                </div>
                <Switch
                  id="show-dialog"
                  checked={showPrintDialog}
                  onCheckedChange={setShowPrintDialog}
                />
              </div>
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-accent text-accent-foreground">
                <Printer className="w-5 h-5" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">Nyomtatási összefoglaló</p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>• Nyomtató: {printerName === 'default' ? 'Alapértelmezett' : printerName}</p>
                  <p>• Példányszám: {copies} db</p>
                  <p>• Papír: {paperSize} ({pageOrientation === 'portrait' ? 'Álló' : 'Fekvő'})</p>
                  <p>• Mód: {colorMode === 'color' ? 'Színes' : 'Fekete-fehér'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Mégse
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
