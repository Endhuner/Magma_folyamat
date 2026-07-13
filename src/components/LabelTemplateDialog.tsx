import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LabelTemplate, exportLabelTemplate, importLabelTemplate, validateLabelTemplate } from '@/lib/labelTemplate'
import { Eye, FloppyDisk, Download, Upload } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface LabelTemplateDialogProps {
  open: boolean
  onClose: () => void
  onSave: (template: LabelTemplate) => void
  template?: LabelTemplate
  onPreview: (template: LabelTemplate) => void
}

const DEFAULT_LABEL_HTML = `<div class="label-cell">
  <div class="label-content">
    <div class="label-product">{{productName}}</div>
    <div class="label-drawing">Rajzszám: {{drawingNumber}}</div>
    <div class="label-order">Vevő rendelési szám: {{ownOrderNumber}}</div>
    <div class="label-date">Határidő: {{requiredDate}}</div>
    <div class="label-pieces">Doboz/db: {{piecesPerBox}}</div>
    <div class="label-boxes">Dobozok száma: {{boxesCount}}</div>
    <div class="label-notes">Megjegyzés (rendelés): {{orderNotes}}</div>
    <div class="label-notes">Megjegyzés (termék): {{productNotes}}</div>
    <div class="label-from-to">
      <span>From: MAGMA</span>
      <span>To: {{customerName}}</span>
    </div>
  </div>
</div>`

const DEFAULT_LABEL_CSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  font-size: 8pt;
  line-height: 1.2;
}

.page {
  width: 210mm;
  height: 297mm;
  page-break-after: always;
  margin: 0 auto;
  padding: 5mm;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  grid-template-rows: repeat(8, 1fr);
  gap: 0;
}

.label-cell {
  border: none;
  padding: 2mm 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  page-break-inside: avoid;
  background: white;
}

.label-content {
  display: flex;
  flex-direction: column;
  gap: 1mm;
  height: 100%;
  width: 100%;
  padding: 2mm;
  text-align: center;
}

.label-product {
  font-weight: bold;
  font-size: 9pt;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.label-drawing {
  font-size: 7pt;
  color: #444;
}

.label-order {
  font-size: 7pt;
  color: #333;
}

.label-date {
  font-size: 7pt;
  color: #666;
}

.label-pieces {
  font-size: 7pt;
  color: #444;
}

.label-boxes {
  font-size: 7pt;
  color: #444;
  font-weight: bold;
}

.label-notes {
  font-size: 6pt;
  color: #666;
  font-style: italic;
}

.label-from-to {
  display: flex;
  justify-content: space-between;
  font-size: 6pt;
  color: #333;
  margin-top: auto;
  padding-top: 1mm;
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }

  .page {
    margin: 0;
    padding: 5mm;
  }
}

@media screen {
  body {
    background: #f0f0f0;
    padding: 20px;
  }

  .page {
    background: white;
    margin: 20px auto;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }
}`

export function LabelTemplateDialog({
  open,
  onClose,
  onSave,
  template,
  onPreview
}: LabelTemplateDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [html, setHtml] = useState(template?.html || DEFAULT_LABEL_HTML)
  const [css, setCss] = useState(template?.css || DEFAULT_LABEL_CSS)
  
  const [pageMarginTop, setPageMarginTop] = useState(template?.margins?.top || '1')
  const [pageMarginRight, setPageMarginRight] = useState(template?.margins?.right || '0')
  const [pageMarginBottom, setPageMarginBottom] = useState(template?.margins?.bottom || '0')
  const [pageMarginLeft, setPageMarginLeft] = useState(template?.margins?.left || '1')
  
  const [contentPaddingTop, setContentPaddingTop] = useState(template?.paddingSettings?.contentPaddingTop || '2')
  const [contentPaddingRight, setContentPaddingRight] = useState(template?.paddingSettings?.contentPaddingRight || '2')
  const [contentPaddingBottom, setContentPaddingBottom] = useState(template?.paddingSettings?.contentPaddingBottom || '2')
  const [contentPaddingLeft, setContentPaddingLeft] = useState(template?.paddingSettings?.contentPaddingLeft || '2')

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name || '')
        setDescription(template.description || '')
        setHtml(template.html || DEFAULT_LABEL_HTML)
        setCss(template.css || DEFAULT_LABEL_CSS)
        setPageMarginTop(template.margins?.top || '1')
        setPageMarginRight(template.margins?.right || '0')
        setPageMarginBottom(template.margins?.bottom || '0')
        setPageMarginLeft(template.margins?.left || '1')
        setContentPaddingTop(template.paddingSettings?.contentPaddingTop || '2')
        setContentPaddingRight(template.paddingSettings?.contentPaddingRight || '2')
        setContentPaddingBottom(template.paddingSettings?.contentPaddingBottom || '2')
        setContentPaddingLeft(template.paddingSettings?.contentPaddingLeft || '2')
      } else {
        setName('')
        setDescription('')
        setHtml(DEFAULT_LABEL_HTML)
        setCss(DEFAULT_LABEL_CSS)
        setPageMarginTop('1')
        setPageMarginRight('0')
        setPageMarginBottom('0')
        setPageMarginLeft('1')
        setContentPaddingTop('2')
        setContentPaddingRight('2')
        setContentPaddingBottom('2')
        setContentPaddingLeft('2')
      }
    }
  }, [template, open])

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('A sablon neve kötelező')
      return
    }

    const templateData: LabelTemplate = {
      id: template?.id || `label-template-${Date.now()}`,
      name: name.trim(),
      type: 'label',
      html,
      css,
      timestamp: template?.timestamp || new Date().toISOString(),
      description: description.trim() || undefined,
      margins: {
        top: pageMarginTop,
        right: pageMarginRight,
        bottom: pageMarginBottom,
        left: pageMarginLeft
      },
      paddingSettings: {
        contentPaddingTop: contentPaddingTop + 'mm',
        contentPaddingRight: contentPaddingRight + 'mm',
        contentPaddingBottom: contentPaddingBottom + 'mm',
        contentPaddingLeft: contentPaddingLeft + 'mm'
      },
      labelsPerPage: 40,
      labelsPerRow: 5,
      labelsPerColumn: 8
    }

    const validationErrors = validateLabelTemplate(templateData)
    const criticalErrors = validationErrors.filter((e: any) => e.severity === 'error')
    const warnings = validationErrors.filter((e: any) => e.severity === 'warning')

    if (criticalErrors.length > 0) {
      const errorMessages = criticalErrors.map((e: any) => e.message).join('\n')
      toast.error(`Validálási hibák:\n${errorMessages}`, {
        duration: 5000
      })
      return
    }

    if (warnings.length > 0) {
      const warningMessages = warnings.map((e: any) => e.message).join('\n')
      toast.warning(`Figyelmeztetések:\n${warningMessages}`, {
        duration: 4000
      })
    }

    onSave(templateData)
    onClose()
  }

  const handlePreview = () => {
    const previewTemplate: LabelTemplate = {
      id: 'preview',
      name: name.trim() || 'Előnézet',
      type: 'label',
      html,
      css,
      timestamp: new Date().toISOString(),
      margins: {
        top: pageMarginTop,
        right: pageMarginRight,
        bottom: pageMarginBottom,
        left: pageMarginLeft
      },
      paddingSettings: {
        contentPaddingTop: contentPaddingTop + 'mm',
        contentPaddingRight: contentPaddingRight + 'mm',
        contentPaddingBottom: contentPaddingBottom + 'mm',
        contentPaddingLeft: contentPaddingLeft + 'mm'
      },
      labelsPerPage: 40,
      labelsPerRow: 5,
      labelsPerColumn: 8
    }
    onPreview(previewTemplate)
  }

  const handleExport = () => {
    const exportTemplate: LabelTemplate = {
      id: template?.id || `label-template-${Date.now()}`,
      name: name.trim() || 'Címke Sablon',
      type: 'label',
      html,
      css,
      timestamp: new Date().toISOString(),
      description: description.trim() || undefined,
      margins: {
        top: pageMarginTop,
        right: pageMarginRight,
        bottom: pageMarginBottom,
        left: pageMarginLeft
      },
      paddingSettings: {
        contentPaddingTop: contentPaddingTop + 'mm',
        contentPaddingRight: contentPaddingRight + 'mm',
        contentPaddingBottom: contentPaddingBottom + 'mm',
        contentPaddingLeft: contentPaddingLeft + 'mm'
      },
      labelsPerPage: 40,
      labelsPerRow: 5,
      labelsPerColumn: 8
    }
    exportLabelTemplate(exportTemplate)
  }

  const handleImport = async () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const imported = await importLabelTemplate(file)
      setName(imported.name)
      setDescription(imported.description || '')
      setHtml(imported.html)
      setCss(imported.css)
      toast.success('Sablon importálva')
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Hiba az importálás során')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? `Címke Sablon Szerkesztése: ${template.name}` : 'Új Címke Sablon'}
          </DialogTitle>
          {template && (
            <p className="text-sm text-muted-foreground mt-2">
              Létrehozva: {new Date(template.timestamp).toLocaleString('hu-HU')}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label-name">Sablon neve *</Label>
              <Input
                id="label-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Címke Sablon - Alap"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="label-description">Leírás</Label>
              <Input
                id="label-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sablon rövid leírása"
              />
            </div>
          </div>

          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <div>
              <h3 className="font-semibold text-sm mb-3">Oldal margók (mm)</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="margin-top" className="text-xs">Felső</Label>
                  <Input
                    id="margin-top"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={pageMarginTop}
                    onChange={(e) => setPageMarginTop(e.target.value)}
                    placeholder="1"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-right" className="text-xs">Jobb</Label>
                  <Input
                    id="margin-right"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={pageMarginRight}
                    onChange={(e) => setPageMarginRight(e.target.value)}
                    placeholder="0"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-bottom" className="text-xs">Alsó</Label>
                  <Input
                    id="margin-bottom"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={pageMarginBottom}
                    onChange={(e) => setPageMarginBottom(e.target.value)}
                    placeholder="0"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="margin-left" className="text-xs">Bal</Label>
                  <Input
                    id="margin-left"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={pageMarginLeft}
                    onChange={(e) => setPageMarginLeft(e.target.value)}
                    placeholder="1"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-3">Címke belső padding (mm)</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="padding-top" className="text-xs">Felső</Label>
                  <Input
                    id="padding-top"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={contentPaddingTop}
                    onChange={(e) => setContentPaddingTop(e.target.value)}
                    placeholder="2"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padding-right" className="text-xs">Jobb</Label>
                  <Input
                    id="padding-right"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={contentPaddingRight}
                    onChange={(e) => setContentPaddingRight(e.target.value)}
                    placeholder="2"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padding-bottom" className="text-xs">Alsó</Label>
                  <Input
                    id="padding-bottom"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={contentPaddingBottom}
                    onChange={(e) => setContentPaddingBottom(e.target.value)}
                    placeholder="2"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="padding-left" className="text-xs">Bal</Label>
                  <Input
                    id="padding-left"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={contentPaddingLeft}
                    onChange={(e) => setContentPaddingLeft(e.target.value)}
                    placeholder="2"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="label-html">HTML Sablon</Label>
            <Textarea
              id="label-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="HTML kód ide..."
              className="font-mono text-xs min-h-[250px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label-css">CSS Stílus</Label>
            <Textarea
              id="label-css"
              value={css}
              onChange={(e) => setCss(e.target.value)}
              placeholder="CSS kód ide..."
              className="font-mono text-xs min-h-[350px]"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button variant="outline" onClick={handleImport}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="w-4 h-4 mr-2" />
              Előnézet
            </Button>
            <Button variant="outline" onClick={onClose}>
              Mégse
            </Button>
            <Button onClick={handleSave}>
              <FloppyDisk className="w-4 h-4 mr-2" />
              Mentés
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
