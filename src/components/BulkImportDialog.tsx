import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Customer } from '@/lib/types'
import { Upload, FileXls, CheckCircle, Warning, X } from '@phosphor-icons/react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { getField, normalizeRow } from '@/lib/importHelpers'

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

      // Az előnézet ugyanazt a fejléc-toleráns kiolvasást használja, mint az import.
      const preview = jsonData.slice(0, 5).map((rawRow) => {
        const r = normalizeRow(rawRow)
        return {
          name: getField(r, 'Vevő név', 'Vevő', 'Név', 'Cégnév', 'Vevő neve'),
          language: getField(r, 'Szállító Nyelve', 'Szállító nyelve', 'Nyelv', 'Vevő nyelve'),
          city: getField(r, 'Város'),
          postalCode: getField(r, 'Irányítószám', 'Ir.szám', 'Postai irányítószám'),
        }
      })
      setPreviewData(preview)
    } catch (error) {
      setErrors([{ row: 0, field: 'file', message: 'Hiba a fájl olvasása során' }])
    }
  }

  const handleImport = async () => {
    if (!file) return

    setImporting(true)
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

      const validationErrors: ImportError[] = []
      const validCustomers: Partial<Customer>[] = []

      jsonData.forEach((rawRow: any, index: number) => {
        const row = normalizeRow(rawRow)
        const name = getField(row, 'Vevő név', 'Vevő', 'Név', 'Cégnév', 'Vevő neve')
        if (!name) {
          validationErrors.push({
            row: index + 2,
            field: 'Vevő név',
            message: 'A vevő nevének kitöltése kötelező',
          })
          return
        }

        validCustomers.push({
          id: crypto.randomUUID(),
          name,
          language: getField(row, 'Szállító Nyelve', 'Szállító nyelve', 'Nyelv', 'Vevő nyelve'),
          city: getField(row, 'Város'),
          postalCode: getField(row, 'Irányítószám', 'Ir.szám', 'Postai irányítószám'),
          street: getField(row, 'Utca, házszám', 'Utca', 'Cím utca', 'Utca és házszám'),
          country: getField(row, 'Ország'),
          fullAddress: getField(row, 'Cím', 'Teljes cím', 'Vevő cím'),
          taxNumber: getField(row, 'Adószám', 'Adószáma', 'Tax number'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      })

      setImporting(false)

      if (validationErrors.length > 0) {
        setErrors(validationErrors)
      }

      if (validCustomers.length > 0) {
        setSuccess(true)
        onImport(validCustomers)
        if (validationErrors.length === 0) {
          setTimeout(() => {
            handleClose()
          }, 1500)
        }
      }
    } catch (error) {
      setImporting(false)
      setErrors([{ row: 0, field: 'file', message: 'Hiba történt az importálás során' }])
    }
  }

  const handleClose = () => {
    setFile(null)
    setErrors([])
    setSuccess(false)
    setPreviewData([])
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
            Töltsön fel egy Excel fájlt (.xlsx) vevői adatokkal. Az oszlopfejléceknek meg kell egyezniük a sablon szerinti elnevezésekkel
            (Vevő név, Szállító Nyelve, Város, Irányítószám, Utca, házszám, Ország, Cím, Adószám). A „Vevő név" kitöltése kötelező.
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
                          <td className="px-2 py-1">{row.name || '-'}</td>
                          <td className="px-2 py-1">{row.language || '-'}</td>
                          <td className="px-2 py-1">{row.city || '-'}</td>
                          <td className="px-2 py-1">{row.postalCode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {importing && (
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
