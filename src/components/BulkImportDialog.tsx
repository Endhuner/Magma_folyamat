import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Customer } from '@/lib/types'
import { Upload, FileXls, CheckCircle, Warning, X, Sparkle } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'

interface BulkImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (customers: Partial<Customer>[]) => void
}

interface ImportError {
  row: number
  field: string
  message: string
}

export function BulkImportDialog({ open, onClose, onImport }: BulkImportDialogProps) {
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
      { key: 'Vevő név', field: 'name' },
      { key: 'Szállító Nyelve', field: 'language' },
      { key: 'Város', field: 'city' },
      { key: 'Irányítószám', field: 'postalCode' },
      { key: 'Utca, házszám', field: 'street' },
      { key: 'Ország', field: 'country' },
      { key: 'Cím', field: 'fullAddress' },
      { key: 'Adószám', field: 'taxNumber' }
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

    const promptText = `Te egy adatfeltöltő asszisztens vagy. A következő vevői adatok hiányosak.

Meglévő adatok: ${availableData || 'Nincs'}
Hiányzó mezők: ${missingFieldNames}

Feladatod: Töltsd ki a hiányzó mezőket ésszerű, realisztikus adatokkal a meglévő információk alapján.

Szabályok:
- Ha van város de nincs irányítószám, adj valós magyarországi irányítószámot
- Ha van város de nincs ország, valószínűleg Magyarország
- Ha van név de nincs nyelv, adj meg egy ésszerű nyelvkódot (pl. HU, EN, DE)
- Ha van város, utca, de nincs teljes cím, állítsd össze a címet
- Ha van név de nincs adószám, generálj valós formátumú magyar adószámot (8 számjegy + 1 + 2 számjegy formátumban)
- Ha hiányzik a város, utca stb., találj ki valós hangzású magyar címadatokat

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

      const validCustomers: Partial<Customer>[] = filledRows.map((row: any, index: number) => {
        return {
          id: `import-${Date.now()}-${index}`,
          name: String(row['Vevő név'] || '').trim(),
          language: String(row['Szállító Nyelve'] || '').trim(),
          city: String(row['Város'] || '').trim(),
          postalCode: String(row['Irányítószám'] || '').trim(),
          street: String(row['Utca, házszám'] || '').trim(),
          country: String(row['Ország'] || '').trim(),
          fullAddress: String(row['Cím'] || '').trim(),
          taxNumber: String(row['Adószám'] || '').trim(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      })

      setImporting(false)
      setSuccess(true)
      onImport(validCustomers)
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
          <DialogTitle>Tömeges Vevő Import</DialogTitle>
          <DialogDescription>
            Töltsön fel egy Excel fájlt (.xlsx) vevői adatokkal. A hiányzó adatok automatikusan kitöltésre kerülnek AI segítségével.
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
              id="file-upload"
            />
            
            {!file ? (
              <label htmlFor="file-upload" className="cursor-pointer">
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
                        <th className="px-2 py-1 text-left font-medium">Vevő név</th>
                        <th className="px-2 py-1 text-left font-medium">Nyelv</th>
                        <th className="px-2 py-1 text-left font-medium">Város</th>
                        <th className="px-2 py-1 text-left font-medium">Irányítószám</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-2 py-1">{row['Vevő név'] || '-'}</td>
                          <td className="px-2 py-1">{row['Szállító Nyelve'] || '-'}</td>
                          <td className="px-2 py-1">{row['Város'] || '-'}</td>
                          <td className="px-2 py-1">{row['Irányítószám'] || '-'}</td>
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
                Sikeres importálás! A vevők hozzáadásra kerültek.
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
