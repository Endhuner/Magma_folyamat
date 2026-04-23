import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/types'
import { Upload, FileXls, CheckCircle, Warning, X, Sparkle } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'

interface ProductBulkImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (products: Partial<Product>[]) => void
}

interface ImportError {
  row: number
  field: string
  message: string
}

export function ProductBulkImportDialog({ open, onClose, onImport }: ProductBulkImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>([])
  const [success, setSuccess] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  const [fillingData, setFillingData] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setErrors([])
      setSuccess(false)
      setPreviewData([])
      parsePreview(selectedFile)
    }
  }

  const parsePreview = async (file: File) => {
    try {
      const ExcelJS = await import('exceljs')
      const data = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(data)
      const worksheet = workbook.worksheets[0]
      const jsonData: any[] = []
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const rowData: any = {}
        const headers = worksheet.getRow(1)
        row.eachCell((cell, colNumber) => {
          const header = headers.getCell(colNumber).value as string
          rowData[header] = cell.value ?? ''
        })
        jsonData.push(rowData)
      })
      
      setPreviewData(jsonData.slice(0, 5))
    } catch (error) {
      setErrors([{ row: 0, field: 'file', message: 'Hiba a fájl olvasása során' }])
    }
  }

  const fillMissingDataWithAI = async (row: any): Promise<any> => {
    const fieldMapping = [
      { key: 'Ügyfél', field: 'customer' },
      { key: 'Termék rajzszáma', field: 'drawingNumber' },
      { key: 'Termék megnevezés', field: 'productName' },
      { key: 'Megjegyzés', field: 'notes' },
      { key: 'Fészekszáma', field: 'nestCount' },
      { key: 'Súly/db', field: 'weightPerPiece' },
      { key: 'Anyag', field: 'material' },
      { key: 'Felületkezelés', field: 'surfaceTreatment' },
      { key: 'Ciklus idő', field: 'cycleTime' },
      { key: 'Utómunka idő', field: 'postProcessingTime' },
      { key: 'Utómunkák', field: 'postProcessing' },
      { key: 'Doboz méret', field: 'boxSize' },
      { key: 'Doboz/db', field: 'piecesPerBox' },
      { key: 'Doboz/Raklap', field: 'boxesPerPallet' },
      { key: 'Arktikál nr.', field: 'articleNumber' },
      { key: 'Raktár', field: 'warehouse' },
      { key: 'Engusz súly', field: 'spruWeight' }
    ]

    const missingFields = fieldMapping.filter(
      ({ key }) => !row[key] || String(row[key]).trim() === ''
    )

    if (missingFields.length === 0) {
      return row
    }

    const availableData = fieldMapping
      .filter(({ key }) => row[key] && String(row[key]).trim() !== '')
      .map(({ key }) => `${key}: ${row[key]}`)
      .join(', ')

    const missingFieldNames = missingFields.map(({ key }) => key).join(', ')

    const promptText = `Te egy termelési adatfeltöltő asszisztens vagy. A következő termék adatok hiányosak.

Meglévő adatok: ${availableData || 'Nincs'}
Hiányzó mezők: ${missingFieldNames}

Feladatod: Töltsd ki a hiányzó mezőket ésszerű, realisztikus adatokkal a meglévő információk és a gyártási/termelési környezet alapján.

Szabályok:
- Ha van termék név de nincs rajzszám, adj valós formátumú rajzszámot (pl. DWG-2024-001)
- Ha van anyag de nincs súly, adj reális súlyt a gyártási kontextusban (pl. "0.5 kg", "250 g")
- Ha van terméknév de nincs anyag, találj ki valós műanyag vagy fém anyagnevet (pl. "PP", "ABS", "Alumínium")
- Ha nincs felületkezelés, adj meg egy valósat (pl. "Porfestés", "Galvanizálás", "Nincs")
- Ha nincs ciklus idő, adj meg valós időtartamot (pl. "45 sec", "2 min")
- Ha nincs fészekszám, adj meg egy reális számot (1, 2, 4, 8)
- Ha nincs doboz méret, adj meg reális karton méretet (pl. "40x30x20 cm")
- Ha nincs raktár hely, adj meg valós kódot (pl. "A-01", "B-12")
- Ha nincs cikkszám, adj valós formátumú kódot (pl. "ART-2024-001")

Válaszolj CSAK és kizárólag JSON formátumban, egy "fields" nevű objektummal, amely tartalmazza a hiányzó mezők értékeit.`

    try {
      const result = await (window as any).spark.llm(promptText, 'gpt-4o-mini', true)
      const parsed = JSON.parse(result)

      if (parsed.fields) {
        for (const [key, value] of Object.entries(parsed.fields)) {
          if (typeof value === 'string' && value.trim() !== '') {
            row[key] = value
          }
        }
      }
    } catch (error) {
      console.error('Hiba az AI kitöltés során:', error)
    }

    return row
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
    setFillingData(true)
    setErrors([])
    setSuccess(false)

    try {
      const ExcelJS = await import('exceljs')
      const data = await file.arrayBuffer()
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(data)
      const worksheet = workbook.worksheets[0]
      const jsonData: any[] = []
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const rowData: any = {}
        const headers = worksheet.getRow(1)
        row.eachCell((cell, colNumber) => {
          const header = headers.getCell(colNumber).value as string
          rowData[header] = cell.value ?? ''
        })
        jsonData.push(rowData)
      })

      const filledRows = []
      for (let i = 0; i < jsonData.length; i++) {
        const filledRow = await fillMissingDataWithAI(jsonData[i])
        filledRows.push(filledRow)
      }

      setFillingData(false)

      const validProducts: Partial<Product>[] = filledRows.map((row: any, index: number) => {
        return {
          id: `import-${Date.now()}-${index}`,
          customer: String(row['Ügyfél'] || '').trim(),
          drawingNumber: String(row['Termék rajzszáma'] || '').trim(),
          productName: String(row['Termék megnevezés'] || '').trim(),
          notes: String(row['Megjegyzés'] || '').trim(),
          nestCount: String(row['Fészekszáma'] || '').trim(),
          weightPerPiece: String(row['Súly/db'] || '').trim(),
          material: String(row['Anyag'] || '').trim(),
          surfaceTreatment: String(row['Felületkezelés'] || '').trim(),
          cycleTime: String(row['Ciklus idő'] || '').trim(),
          postProcessingTime: String(row['Utómunka idő'] || '').trim(),
          postProcessing: String(row['Utómunkák'] || '').trim(),
          boxSize: String(row['Doboz méret'] || '').trim(),
          piecesPerBox: String(row['Doboz/db'] || '').trim(),
          boxesPerPallet: String(row['Doboz/Raklap'] || '').trim(),
          articleNumber: String(row['Arktikál nr.'] || '').trim(),
          warehouse: String(row['Raktár'] || '').trim(),
          spruWeight: String(row['Engusz súly'] || '').trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      setImporting(false)
      setSuccess(true)
      onImport(validProducts)
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (error) {
      setImporting(false)
      setFillingData(false)
      setErrors([{ row: 0, field: 'file', message: 'Hiba történt az importálás során' }])
    }
  }

  const handleClose = () => {
    setFile(null)
    setErrors([])
    setSuccess(false)
    setPreviewData([])
    setFillingData(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile)
      setErrors([])
      setSuccess(false)
      setPreviewData([])
      parsePreview(droppedFile)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tömeges Termék Import</DialogTitle>
          <DialogDescription>
            Töltsön fel egy Excel fájlt (.xlsx) termék adatokkal. A hiányzó adatok automatikusan kitöltésre kerülnek AI segítségével.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="product-file-upload"
            />
            
            {!file ? (
              <label htmlFor="product-file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" weight="duotone" />
                <p className="text-sm font-medium mb-1">Kattintson vagy húzza ide a fájlt</p>
                <p className="text-xs text-muted-foreground">Excel fájl (.xlsx, .xls)</p>
              </label>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <FileXls className="w-8 h-8 text-accent" weight="duotone" />
                <div className="text-left">
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFile(null)
                    setPreviewData([])
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {previewData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Előnézet (első 5 sor):</h4>
              <div className="border rounded-md overflow-x-auto">
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium">Ügyfél</th>
                        <th className="px-2 py-1 text-left font-medium">Rajzszám</th>
                        <th className="px-2 py-1 text-left font-medium">Termék</th>
                        <th className="px-2 py-1 text-left font-medium">Anyag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">{row['Ügyfél'] || '-'}</td>
                          <td className="px-2 py-1">{row['Termék rajzszáma'] || '-'}</td>
                          <td className="px-2 py-1">{row['Termék megnevezés'] || '-'}</td>
                          <td className="px-2 py-1">{row['Anyag'] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {fillingData && (
            <Alert className="bg-primary/10 border-primary">
              <Sparkle className="w-4 h-4 text-primary animate-pulse" weight="fill" />
              <AlertDescription className="text-primary-foreground">
                AI kitölti a hiányzó adatokat...
              </AlertDescription>
            </Alert>
          )}

          {importing && !fillingData && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Importálás folyamatban...</p>
              <Progress value={undefined} className="w-full" />
            </div>
          )}

          {success && (
            <Alert className="bg-success/10 border-success">
              <CheckCircle className="w-4 h-4 text-success" weight="fill" />
              <AlertDescription className="text-success-foreground">
                Sikeres importálás! A termékek hozzáadásra kerültek.
              </AlertDescription>
            </Alert>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <Warning className="w-4 h-4" weight="fill" />
              <AlertDescription>
                <p className="font-medium mb-2">Hibák az importálás során:</p>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {errors.slice(0, 10).map((error, idx) => (
                    <li key={idx}>
                      Sor {error.row}: {error.message}
                    </li>
                  ))}
                  {errors.length > 10 && (
                    <li className="font-medium">...és még {errors.length - 10} hiba</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Mégse
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={!file || importing || success}
          >
            {importing ? 'Importálás...' : 'Importálás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
