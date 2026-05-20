import { useState, useEffect, useRef, useCallback } from 'react'
import { useKV } from '@/hooks/useKV'
import { useServerCrud } from '@/lib/providers/useServerCrud'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code, Eye, FloppyDisk, Upload, Download, ArrowCounterClockwise, FileHtml, SplitVertical, FolderOpen, CaretDown, CaretUp, Copy, Check, PencilSimple, Trash, CopySimple } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Order, Customer, Product } from '@/lib/types'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface TemplateData {
  id: string
  name: string
  type: 'cmr' | 'delivery' | 'pallet' | 'box-label'
  html: string
  css: string
  timestamp: string
  description?: string
  margins?: {
    top: string
    right: string
    bottom: string
    left: string
  }
}

interface SavedTemplate {
  id: string
  name: string
  timestamp: string
  size: number
  data: TemplateData
}

const DEFAULT_CMR_HTML = ``
const DEFAULT_CMR_CSS = ``
const DEFAULT_DELIVERY_HTML = ``
const DEFAULT_DELIVERY_CSS = ``

const DEFAULT_PALLET_HTML = `<div class="pallet-label">
  <div class="header-row">
    <div class="header-cell">
      <div class="header-title">Vevő / Kaufer</div>
      <div class="address-name">{{customerName}}</div>
      <div class="address-line">{{customerCity}}</div>
      <div class="address-line">{{customerStreet}}</div>
      <div class="address-line">{{customerPostalCode}}</div>
    </div>
    <div class="header-cell right-cell">
      <div class="header-title">Feladó / Absender</div>
      <div class="address-name">MAGMA KFT</div>
      <div class="address-line">Budapest</div>
      <div class="address-line">Déli u. 13.</div>
      <div class="address-line">H-1211</div>
    </div>
  </div>
  <div class="info-row">
    <div class="info-label">Order No.:</div>
    <div class="info-value order-no">{{orderNo}}</div>
  </div>
  <div class="info-row">
    <div class="info-label">Cikkszám / Artikelnummer:</div>
    <div class="info-value bold">{{drawingNumber}}</div>
  </div>
  <div class="qty-row">
    <div class="qty-cell">
      <div class="qty-number">{{boxesOnPallet}}</div>
      <div class="qty-unit">karton / Karton</div>
    </div>
    <div class="qty-cell">
      <div class="qty-number">{{piecesPerBox}}</div>
      <div class="qty-unit">db/karton / Stk/Karton</div>
    </div>
    <div class="qty-cell highlight">
      <div class="qty-number">{{totalPieces}}</div>
      <div class="qty-unit">db / Stück</div>
    </div>
  </div>
  <div class="weight-row">
    <div class="weight-cell">
      <span class="weight-label">Nettó:</span>
      <span class="weight-value">{{nettoKg}} kg</span>
    </div>
    <div class="weight-cell">
      <span class="weight-label">Bruttó:</span>
      <span class="weight-value">{{bruttoKg}} kg</span>
    </div>
  </div>
  <div class="pallet-counter">Raklap / Palette: {{palletIndex}} / {{totalPallets}}</div>
</div>`

const DEFAULT_PALLET_CSS = `* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 12pt; color: #000; }
.pallet-label { width: 190mm; min-height: 130mm; border: 2px solid #000; padding: 6mm; margin-bottom: 10mm; page-break-inside: avoid; display: flex; flex-direction: column; gap: 4mm; }
.header-row { display: flex; gap: 4mm; border-bottom: 1.5px solid #000; padding-bottom: 4mm; }
.header-cell { flex: 1; }
.right-cell { border-left: 1.5px solid #000; padding-left: 4mm; }
.header-title { font-size: 8pt; font-weight: bold; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2mm; }
.address-name { font-size: 13pt; font-weight: bold; line-height: 1.3; }
.address-line { font-size: 11pt; line-height: 1.4; }
.info-row { display: flex; gap: 3mm; align-items: baseline; }
.info-label { font-size: 9pt; color: #444; min-width: 42mm; }
.info-value { font-size: 14pt; }
.info-value.bold { font-weight: bold; }
.info-value.order-no { font-size: 24pt; font-weight: bold; letter-spacing: 0.5px; }
.qty-row { display: flex; gap: 3mm; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 3mm 0; }
.qty-cell { flex: 1; text-align: center; border-right: 1px solid #ccc; padding: 1mm 2mm; }
.qty-cell:last-child { border-right: none; }
.qty-cell.highlight { background: #f0f0f0; }
.qty-number { font-size: 22pt; font-weight: bold; line-height: 1.1; }
.qty-unit { font-size: 8pt; color: #555; margin-top: 1mm; }
.weight-row { display: flex; gap: 8mm; }
.weight-cell { display: flex; gap: 2mm; align-items: baseline; }
.weight-label { font-size: 9pt; color: #444; }
.weight-value { font-size: 13pt; font-weight: bold; }
.pallet-counter { margin-top: auto; text-align: right; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 2mm; }`

const DEFAULT_BOX_LABEL_HTML = `<div class="label-designation">{{designation}} - {{drawingNumber}}</div>
<div class="label-qty">{{piecesPerBox}} pcs-{{material}}</div>
<div class="label-order">{{orderNumber}} - {{requiredDate}}</div>
<div class="label-parties">From: MAGMA&nbsp;&nbsp;To: {{customer}}</div>`

const DEFAULT_BOX_LABEL_CSS = `.label-designation {
  font-size: 10pt;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.label-qty { font-size: 9pt; margin-top: 1mm; }
.label-order { font-size: 9pt; margin-top: 1mm; }
.label-parties { font-size: 8pt; margin-top: 1mm; color: #333; }`

// --- Változó lista definíció ---
const TEMPLATE_VARIABLES = [
  {
    group: '📄 Dokumentum',
    vars: [
      { token: '{{sequenceNumber}}', label: 'Dokumentum sorszáma' },
      { token: '{{documentNumber}}', label: 'Sorszám (alias)' },
      { token: '{{issueDate}}',      label: 'Kiállítás dátuma' },
      { token: '{{deliveryDate}}',   label: 'Szállítási dátum' },
    ],
  },
  {
    group: '🏢 Feladó (CMR beállításokból)',
    vars: [
      { token: '{{senderName}}',      label: 'Feladó neve' },
      { token: '{{senderAddress}}',   label: 'Feladó címe' },
      { token: '{{senderCity}}',      label: 'Feladó városa' },
      { token: '{{senderCountry}}',   label: 'Feladó országa' },
      { token: '{{senderTaxNumber}}', label: 'Feladó adószáma' },
    ],
  },
  {
    group: '👤 Vevő adatok',
    vars: [
      { token: '{{customerName}}',      label: 'Vevő neve' },
      { token: '{{customerAddress}}',   label: 'Vevő teljes címe' },
      { token: '{{customerCity}}',      label: 'Vevő városa' },
      { token: '{{customerCountry}}',   label: 'Vevő országa' },
      { token: '{{customerTaxNumber}}', label: 'Vevő adószáma' },
    ],
  },
  {
    group: '🚚 Szállítás',
    vars: [
      { token: '{{carrierName}}',      label: 'Fuvarozó neve' },
      { token: '{{carrierAddress}}',   label: 'Fuvarozó címe' },
      { token: '{{vehiclePlate}}',     label: 'Rendszám' },
      { token: '{{pickupLocation}}',   label: 'Átvétel helye' },
      { token: '{{deliveryLocation}}', label: 'Szállítás helye' },
    ],
  },
  {
    group: '📦 Rendelés (első sor, cikluson kívül)',
    vars: [
      { token: '{{ownOrderNumber}}', label: 'Saját rendelési szám', warn: true },
      { token: '{{orderNumber}}',    label: 'Vevő rendelési száma', warn: true },
      { token: '{{productName}}',    label: 'Termék neve' },
      { token: '{{designation}}',    label: 'Megnevezés' },
    ],
  },
  {
    group: '🔢 Összesítők',
    vars: [
      { token: '{{totalQuantity}}', label: 'Összes mennyiség (db)' },
      { token: '{{totalBoxes}}',    label: 'Összes doboz (db)' },
      { token: '{{totalPallets}}',  label: 'Összes raklap (db)' },
      { token: '{{totalWeight}}',   label: 'Összes bruttó súly (kg)' },
    ],
  },
  {
    group: '🔄 {{#items}} cikluson belül',
    vars: [
      { token: '{{index}}',          label: 'Sorszám (1, 2, 3…)' },
      { token: '{{ownOrderNumber}}', label: 'Saját rendelési szám ✅' },
      { token: '{{orderNumber}}',    label: 'Vevő rendelési száma ✅' },
      { token: '{{productName}}',    label: 'Termék neve' },
      { token: '{{designation}}',    label: 'Megnevezés' },
      { token: '{{quantity}}',       label: 'Mennyiség (db)' },
      { token: '{{boxes}}',          label: 'Dobozok száma' },
      { token: '{{pallets}}',        label: 'Raklapok száma' },
      { token: '{{weight}}',         label: 'Bruttó súly (kg)' },
      { token: '{{packaging}}',      label: 'Csomagolás típusa' },
      { token: '{{grossWeight}}',    label: 'Bruttó súly (alias)' },
      { token: '{{volume}}',         label: 'Térfogat (m³)' },
    ],
  },
  {
    group: '🏷️ Etiketta változók (4×10 rács, egy cella tartalma)',
    vars: [
      { token: '{{designation}}',   label: 'Megnevezés (rendelésből)' },
      { token: '{{drawingNumber}}', label: 'Rajzszám / cikkszám' },
      { token: '{{piecesPerBox}}',  label: 'Db/karton' },
      { token: '{{material}}',      label: 'Anyag' },
      { token: '{{orderNumber}}',   label: 'Vevő rendelési száma' },
      { token: '{{requiredDate}}',  label: 'Határidő (YYYY.MM.DD)' },
      { token: '{{customer}}',      label: 'Vevő neve' },
    ],
  },
  {
    group: '📦 Raklap cimke változók',
    vars: [
      { token: '{{customerName}}',      label: 'Vevő neve' },
      { token: '{{customerCity}}',      label: 'Vevő városa' },
      { token: '{{customerStreet}}',    label: 'Vevő utcája' },
      { token: '{{customerPostalCode}}',label: 'Vevő irányítószáma' },
      { token: '{{orderNo}}',           label: 'Vevő rendelési száma' },
      { token: '{{drawingNumber}}',     label: 'Cikkszám / Rajzszám' },
      { token: '{{boxesOnPallet}}',     label: 'Karton ezen a raklapon' },
      { token: '{{piecesPerBox}}',      label: 'Db/karton' },
      { token: '{{totalPieces}}',       label: 'Összes db (raklapon)' },
      { token: '{{nettoKg}}',           label: 'Nettó súly (kg)' },
      { token: '{{bruttoKg}}',          label: 'Bruttó súly (kg)' },
      { token: '{{palletIndex}}',       label: 'Raklap sorszáma' },
      { token: '{{totalPallets}}',      label: 'Összes raklap' },
    ],
  },
]

export function GithubStyleTemplateEditor() {
  // ------------------------------------------------------------------ API
  const savedTemplatesApi = useServerCrud<SavedTemplate>('saved-templates', ['order'])
  const savedTemplates = savedTemplatesApi.items
  const setSavedTemplates = (updater: SavedTemplate[] | ((prev: SavedTemplate[]) => SavedTemplate[])) => {
    const current = savedTemplatesApi.items
    const next = typeof updater === 'function' ? updater(current) : updater
    const prevMap = new Map(current.map(i => [i.id, i]))
    const nextMap = new Map(next.map(i => [i.id, i]))
    for (const item of current) { if (!nextMap.has(item.id)) savedTemplatesApi.remove(item.id) }
    for (const item of next) {
      if (!prevMap.has(item.id)) savedTemplatesApi.add(item)
      else if (JSON.stringify(prevMap.get(item.id)) !== JSON.stringify(item)) savedTemplatesApi.replace(item)
    }
  }

  const ordersApi = useServerCrud<Order>('orders', ['order'])
  const customersApi = useServerCrud<Customer>('customers', ['customer'])
  const productsApi = useServerCrud<Product>('products', ['product'])
  const orders = ordersApi.items
  const customers = customersApi.items

  // ------------------------------------------------------------------ KV draft
  const [selectedTemplateId, setSelectedTemplateId] = useKV<string | null>('selected-template-id', null)
  const [draftHtml, setDraftHtml] = useKV<Record<string, string>>('template-draft-html', {})
  const [draftCss, setDraftCss] = useKV<Record<string, string>>('template-draft-css', {})

  // ------------------------------------------------------------------ Szerkesztő state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null)
  const [editMode, setEditMode] = useState<'code' | 'preview' | 'split'>('split')
  const [htmlContent, setHtmlContent] = useState('')
  const [cssContent, setCssContent] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const [marginTop, setMarginTop] = useState('10')
  const [marginRight, setMarginRight] = useState('10')
  const [marginBottom, setMarginBottom] = useState('10')
  const [marginLeft, setMarginLeft] = useState('10')

  // ------------------------------------------------------------------ Dialógusok
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateType, setTemplateType] = useState<'cmr' | 'delivery' | 'pallet' | 'box-label'>('delivery')
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFileContent, setImportFileContent] = useState('')

  // ------------------------------------------------------------------ Változó panel
  const [showReferencePanel, setShowReferencePanel] = useState(true)

  // ------------------------------------------------------------------ Inline átnevezés
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  // ------------------------------------------------------------------ Cursor insert
  // Nyomkövetjük, melyik textarea volt utoljára fókuszban, és hol állt a kurzor
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null)
  const cssTextareaRef  = useRef<HTMLTextAreaElement>(null)
  const lastEditorRef   = useRef<'html' | 'css'>('html')
  const lastCursorRef   = useRef<{ start: number; end: number }>({ start: 0, end: 0 })

  const previewRef = useRef<HTMLIFrameElement>(null)

  // ------------------------------------------------------------------ Sablon betöltés
  useEffect(() => {
    if (selectedTemplateId && savedTemplates && savedTemplates.length > 0) {
      const saved = savedTemplates.find(s => s.id === selectedTemplateId)
      if (saved && (!selectedTemplate || selectedTemplate.id !== saved.id)) {
        const templateToEdit: TemplateData = {
          id: saved.id,
          name: saved.name,
          type: saved.data.type,
          html: saved.data.html,
          css: saved.data.css,
          timestamp: saved.timestamp,
          description: saved.data.description,
          margins: saved.data.margins,
        }
        setSelectedTemplate(templateToEdit)
        if (saved.data.margins) {
          setMarginTop(saved.data.margins.top)
          setMarginRight(saved.data.margins.right)
          setMarginBottom(saved.data.margins.bottom)
          setMarginLeft(saved.data.margins.left)
        }
        const hasDraft = draftHtml && draftHtml[saved.id]
        if (hasDraft) {
          setHtmlContent(draftHtml[saved.id] || saved.data.html)
          setCssContent((draftCss || {})[saved.id] || saved.data.css)
        } else {
          setHtmlContent(saved.data.html)
          setCssContent(saved.data.css)
        }
      }
    }
  }, [savedTemplates, selectedTemplateId, selectedTemplate, draftHtml, draftCss])

  // ------------------------------------------------------------------ Draft mentés
  useEffect(() => {
    if (selectedTemplate) {
      const changed = htmlContent !== selectedTemplate.html || cssContent !== selectedTemplate.css
      setHasUnsavedChanges(changed)
      if (changed) {
        setDraftHtml(cur => ({ ...(cur || {}), [selectedTemplate.id]: htmlContent }))
        setDraftCss(cur => ({ ...(cur || {}), [selectedTemplate.id]: cssContent }))
      } else {
        setDraftHtml(cur => { const u = { ...(cur || {}) }; delete u[selectedTemplate.id]; return u })
        setDraftCss(cur => { const u = { ...(cur || {}) }; delete u[selectedTemplate.id]; return u })
      }
    }
  }, [htmlContent, cssContent, selectedTemplate, setDraftHtml, setDraftCss])

  // ------------------------------------------------------------------ Előnézet frissítés
  useEffect(() => { updatePreview() }, [htmlContent, cssContent, editMode, marginTop, marginRight, marginBottom, marginLeft])

  // ------------------------------------------------------------------ Gyorsbillentyűk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges && selectedTemplate) handleSaveTemplate()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        if (selectedTemplate) handleExportTemplate()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setEditMode('preview')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges, selectedTemplate])

  // ------------------------------------------------------------------ Rename focus
  useEffect(() => {
    if (renameId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renameId])

  // ------------------------------------------------------------------ Cursor tracking
  const onTextareaFocus = (editor: 'html' | 'css') => {
    lastEditorRef.current = editor
  }
  const onTextareaSelect = (editor: 'html' | 'css', e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    lastEditorRef.current = editor
    lastCursorRef.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  // ------------------------------------------------------------------ Változó insert
  const insertVariable = useCallback((token: string) => {
    const isHtml = lastEditorRef.current === 'html'
    const ref = isHtml ? htmlTextareaRef : cssTextareaRef
    const el = ref.current

    if (el) {
      el.focus()
      const { start, end } = lastCursorRef.current
      const current = isHtml ? htmlContent : cssContent
      const before = current.substring(0, start)
      const after  = current.substring(end)
      const newVal = before + token + after
      const newPos = start + token.length

      if (isHtml) {
        setHtmlContent(newVal)
      } else {
        setCssContent(newVal)
      }

      // Kurzor visszahelyezése az insert után
      requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.selectionStart = newPos
          ref.current.selectionEnd   = newPos
          ref.current.focus()
          lastCursorRef.current = { start: newPos, end: newPos }
        }
      })
      toast.success(`Beszúrva: ${token}`, { duration: 1200 })
    } else {
      // Nincs fókuszált textarea — vágólapra másolja
      navigator.clipboard.writeText(token).catch(() => {})
      toast.success(`Vágólapra másolva: ${token}`)
    }
  }, [htmlContent, cssContent])

  // ------------------------------------------------------------------ Előnézet generálás
  const updatePreview = () => {
    if (!previewRef.current) return
    const sampleData = generateSampleData()
    const processedHtml = processTemplate(htmlContent, sampleData)
    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm; }
    body {
      margin: 0;
      padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
      position: relative;
    }
    body::before {
      content: "";
      position: fixed;
      top: ${marginTop}mm; left: ${marginLeft}mm;
      right: ${marginRight}mm; bottom: ${marginBottom}mm;
      border: 2px dashed rgba(59,130,246,0.5);
      pointer-events: none; z-index: 9999;
    }
    ${cssContent}
  </style>
</head>
<body>${processedHtml}</body>
</html>`
    const doc = previewRef.current.contentDocument
    if (doc) { doc.open(); doc.write(fullHtml); doc.close() }
  }

  const generateSampleData = () => {
    const sampleOrders = orders && orders.length > 0 ? orders.slice(0, 3) : [
      { orderNumber: 'ORD-001', ownOrderNumber: 'VEVO-REF-001', customer: 'Példa Cég Kft', productName: 'Alkatrész A', designation: 'Példa megnevezés 1', amountPc: 100, boxesCount: 5, palletsCount: 2, grossWeightKg: '250' },
      { orderNumber: 'ORD-002', ownOrderNumber: 'VEVO-REF-002', customer: 'Példa Cég Kft', productName: 'Alkatrész B', designation: 'Példa megnevezés 2', amountPc: 50,  boxesCount: 3, palletsCount: 1, grossWeightKg: '120' },
      { orderNumber: 'ORD-003', ownOrderNumber: 'VEVO-REF-003', customer: 'Példa Cég Kft', productName: 'Alkatrész C', designation: 'Példa megnevezés 3', amountPc: 200, boxesCount: 10, palletsCount: 3, grossWeightKg: '180' },
    ]
    const sampleCustomer = customers && customers.length > 0 ? customers[0] : { name: 'Példa Cég Kft', fullAddress: 'Példa utca 123, Budapest, 1234', city: 'Budapest', postalCode: '1234', country: 'Magyarország', taxNumber: '12345678-1-23' }
    const totalPallets  = sampleOrders.reduce((s, o) => s + (o.palletsCount || 0), 0)
    const totalWeight   = sampleOrders.reduce((s, o) => s + (parseFloat(String(o.grossWeightKg || 0)) || 0), 0)
    const totalQuantity = sampleOrders.reduce((s, o) => s + (o.amountPc || 0), 0)
    const totalBoxes    = sampleOrders.reduce((s, o) => s + (o.boxesCount || 0), 0)
    return {
      documentNumber: 'DOC-001', sequenceNumber: 'SZ-2024-001',
      senderName: 'Magma Kft', senderAddress: 'H-1211 Budapest, Déli utca 13.', senderCountry: 'Magyarország', senderCity: 'Budapest', senderTaxNumber: 'HU10368152-2-43',
      recipientName: sampleCustomer.name, recipientAddress: (sampleCustomer as any).fullAddress, recipientCountry: (sampleCustomer as any).country,
      customerName: sampleCustomer.name, customerAddress: (sampleCustomer as any).fullAddress, customerCity: (sampleCustomer as any).city, customerCountry: (sampleCustomer as any).country, customerTaxNumber: (sampleCustomer as any).taxNumber,
      pickupLocation: 'Budapest, Hungary', deliveryLocation: `${(sampleCustomer as any).city}, ${(sampleCustomer as any).country}`,
      deliveryDate: new Date().toLocaleDateString('hu-HU'), issueDate: new Date().toLocaleDateString('hu-HU'),
      orderNumber: sampleOrders[0].orderNumber || 'N/A', ownOrderNumber: sampleOrders[0].ownOrderNumber || 'N/A',
      productName: sampleOrders[0].productName,
      carrierName: '', carrierAddress: '', vehiclePlate: '',
      items: sampleOrders.map((o, idx) => ({
        index: String(idx + 1), designation: (o as any).designation || o.productName, productName: o.productName,
        quantity: String(o.amountPc || 0), packaging: `${o.boxesCount || 0} doboz`,
        boxes: String(o.boxesCount || 0), pallets: String(o.palletsCount || 0),
        weight: o.grossWeightKg || '0', grossWeight: o.grossWeightKg || '0', volume: '0.00',
        orderNumber: o.orderNumber || 'N/A', ownOrderNumber: o.ownOrderNumber || 'N/A',
      })),
      totalQuantity: String(totalQuantity), totalBoxes: String(totalBoxes), totalPallets: String(totalPallets), totalWeight: totalWeight.toFixed(2),
      // Etiketta + Raklap cimke előnézet adatok
      designation: sampleOrders[0].designation || '8024290',
      material: (sampleOrders[0] as any).material || 'Zamak',
      requiredDate: new Date().toLocaleDateString('hu-HU').replace(/\. /g, '.').replace(/\.$/, '').replace(/\//g, '.'),
      piecesPerBox: '350',
      customerStreet: (sampleCustomer as any).street || 'Minta utca 1.',
      customerPostalCode: (sampleCustomer as any).postalCode || '1234',
      orderNo: sampleOrders[0].orderNumber || '4500104784',
      drawingNumber: 'MA51',
      boxesOnPallet: 45,
      totalPieces: 15750,
      nettoKg: 449,
      bruttoKg: 479,
      palletIndex: 1,
    }
  }

  const processTemplate = (html: string, data: any): string => {
    let processed = html
    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) {
        processed = processed.replace(new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g'), (_m, tmpl) =>
          data[key].map((item: any) => {
            let h = tmpl
            Object.keys(item).forEach(k => { h = h.replace(new RegExp(`{{${k}}}`, 'g'), item[k]) })
            return h
          }).join('')
        )
      } else {
        processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '')
      }
    })
    return processed
  }

  // ------------------------------------------------------------------ Sablon műveletek
  const handleSaveTemplate = () => {
    if (!selectedTemplate) { toast.error('Nincs kiválasztott sablon'); return }
    const currentHtml = htmlContent.trim()
    if (!currentHtml) { toast.error('A HTML sablon nem lehet üres'); return }
    const templateData: TemplateData = {
      id: selectedTemplate.id, name: selectedTemplate.name, type: selectedTemplate.type,
      html: currentHtml, css: cssContent.trim(), timestamp: new Date().toISOString(),
      description: selectedTemplate.description, margins: { top: marginTop, right: marginRight, bottom: marginBottom, left: marginLeft },
    }
    setSavedTemplates(current => {
      const existing = (current || []).find(s => s.id === selectedTemplateId)
      if (existing) {
        return (current || []).map(s => s.id === selectedTemplateId ? { ...s, timestamp: new Date().toISOString(), size: JSON.stringify(templateData).length, data: { ...templateData, id: s.id } } : s)
      } else {
        const newId = Date.now().toString()
        const saveName = `${selectedTemplate.name} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`
        const newSave: SavedTemplate = { id: newId, name: saveName, timestamp: new Date().toISOString(), size: JSON.stringify(templateData).length, data: { ...templateData, id: newId } }
        setSelectedTemplateId(newId)
        setSelectedTemplate({ ...templateData, id: newId, name: saveName })
        return [newSave, ...(current || [])]
      }
    })
    setDraftHtml(cur => { const u = { ...(cur || {}) }; delete u[selectedTemplate.id]; if (selectedTemplateId) delete u[selectedTemplateId]; return u })
    setDraftCss(cur => { const u = { ...(cur || {}) }; delete u[selectedTemplate.id]; if (selectedTemplateId) delete u[selectedTemplateId]; return u })
    setHasUnsavedChanges(false)
    toast.success('Sablon sikeresen mentve')
  }

  const handleCreateNewTemplate = () => {
    if (!templateName.trim()) { toast.error('Add meg a sablon nevét'); return }
    const newId = `template-${Date.now()}`
    const defaultHtml = templateType === 'cmr' ? DEFAULT_CMR_HTML : templateType === 'pallet' ? DEFAULT_PALLET_HTML : templateType === 'box-label' ? DEFAULT_BOX_LABEL_HTML : DEFAULT_DELIVERY_HTML
    const defaultCss  = templateType === 'cmr' ? DEFAULT_CMR_CSS  : templateType === 'pallet' ? DEFAULT_PALLET_CSS  : templateType === 'box-label' ? DEFAULT_BOX_LABEL_CSS  : DEFAULT_DELIVERY_CSS
    const newData: TemplateData = { id: newId, name: templateName, type: templateType, html: defaultHtml, css: defaultCss, timestamp: new Date().toISOString(), description: templateDescription }
    const saveName = `${templateName} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`
    setSavedTemplates(cur => [{ id: newId, name: saveName, timestamp: new Date().toISOString(), size: JSON.stringify(newData).length, data: newData }, ...(cur || [])])
    setSelectedTemplate(newData); setSelectedTemplateId(newId); setHtmlContent(newData.html); setCssContent(newData.css)
    setTemplateName(''); setTemplateDescription(''); setSaveDialogOpen(false)
    toast.success('Új sablon létrehozva')
  }

  const handleLoadSavedTemplate = (saved: SavedTemplate) => {
    if (hasUnsavedChanges && !confirm('Van mentetlen módosítás. Biztosan betöltöd a sablont?')) return
    const tpl: TemplateData = { id: saved.id, name: saved.name, type: saved.data.type, html: saved.data.html, css: saved.data.css, timestamp: saved.timestamp, description: saved.data.description, margins: saved.data.margins }
    setSelectedTemplate(tpl); setSelectedTemplateId(saved.id)
    if (saved.data.margins) { setMarginTop(saved.data.margins.top); setMarginRight(saved.data.margins.right); setMarginBottom(saved.data.margins.bottom); setMarginLeft(saved.data.margins.left) }
    const hasDraft = draftHtml?.[saved.id]
    setHtmlContent(hasDraft ? (draftHtml[saved.id] || saved.data.html) : saved.data.html)
    setCssContent(hasDraft ? ((draftCss || {})[saved.id] || saved.data.css) : saved.data.css)
    setHasUnsavedChanges(false)
    toast.success(`Betöltve: ${saved.name}`)
  }

  const handleExportTemplate = () => {
    if (!selectedTemplate) return
    const exportData = { name: selectedTemplate.name, type: selectedTemplate.type, html: htmlContent, css: cssContent, description: selectedTemplate.description, exportDate: new Date().toISOString(), version: '1.0' }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${selectedTemplate.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    toast.success('Sablon exportálva')
  }

  const handleImportTemplate = () => {
    try {
      const importedData = JSON.parse(importFileContent)
      if (!importedData.html) { toast.error('Érvénytelen sablon formátum (hiányzik a html mező)'); return }
      const newId = `template-${Date.now()}`
      const newData: TemplateData = { id: newId, name: importedData.name || 'Importált Sablon', type: importedData.type || 'delivery', html: importedData.html, css: importedData.css || '', timestamp: new Date().toISOString(), description: importedData.description || '' }
      const saveName = `${newData.name} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`
      setSavedTemplates(cur => [{ id: newId, name: saveName, timestamp: new Date().toISOString(), size: JSON.stringify(newData).length, data: newData }, ...(cur || [])])
      setSelectedTemplate(newData); setSelectedTemplateId(newId); setHtmlContent(newData.html); setCssContent(newData.css)
      setImportFileContent(''); setImportDialogOpen(false)
      toast.success('Sablon importálva')
    } catch { toast.error('Hiba a sablon importálása során') }
  }

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a sablont?')) return
    setSavedTemplates(current => {
      const filtered = (current || []).filter(t => t.id !== id)
      if (selectedTemplate?.id === id) {
        const next = filtered[0] || null
        if (next) handleLoadSavedTemplate(next)
        else { setSelectedTemplate(null); setSelectedTemplateId(null); setHtmlContent(''); setCssContent('') }
      }
      return filtered
    })
    toast.success('Sablon törölve')
  }

  const handleDuplicateTemplate = (saved: SavedTemplate) => {
    const newId = Date.now().toString()
    const copyName = `${saved.name} (másolat)`
    const newData: TemplateData = { ...saved.data, id: newId, name: copyName, timestamp: new Date().toISOString() }
    const newSave: SavedTemplate = { id: newId, name: copyName, timestamp: new Date().toISOString(), size: saved.size, data: newData }
    setSavedTemplates(cur => [newSave, ...(cur || [])])
    toast.success('Sablon másolata létrehozva')
  }

  const startRename = (saved: SavedTemplate) => {
    setRenameId(saved.id)
    setRenameValue(saved.name)
  }

  const commitRename = () => {
    if (!renameId || !renameValue.trim()) { setRenameId(null); return }
    setSavedTemplates(cur => (cur || []).map(s => s.id === renameId ? { ...s, name: renameValue.trim(), data: { ...s.data, name: renameValue.trim() } } : s))
    if (selectedTemplate?.id === renameId) setSelectedTemplate(t => t ? { ...t, name: renameValue.trim() } : t)
    setRenameId(null)
    toast.success('Sablon átnevezve')
  }

  const handleResetToDefault = () => {
    if (!confirm('Biztosan visszaállítod az alapértelmezett sablont?')) return
    const t = selectedTemplate?.type
    setHtmlContent(t === 'cmr' ? DEFAULT_CMR_HTML : t === 'pallet' ? DEFAULT_PALLET_HTML : t === 'box-label' ? DEFAULT_BOX_LABEL_HTML : DEFAULT_DELIVERY_HTML)
    setCssContent(t === 'cmr' ? DEFAULT_CMR_CSS : t === 'pallet' ? DEFAULT_PALLET_CSS : t === 'box-label' ? DEFAULT_BOX_LABEL_CSS : DEFAULT_DELIVERY_CSS)
    toast.success('Alapértelmezett sablon visszaállítva')
  }

  // ------------------------------------------------------------------ Render
  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Sablon Szerkesztő</h2>
          <p className="text-muted-foreground">HTML/CSS sablon szerkesztő élő előnézettel</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
            <FileHtml className="w-4 h-4 mr-2" />Új Sablon
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />Importálás
          </Button>
          <Button variant="outline" onClick={handleExportTemplate} disabled={!selectedTemplate}>
            <Download className="w-4 h-4 mr-2" />Exportálás
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* ---- Bal oldal: sablon lista ---- */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Mentett sablonok</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {(savedTemplates || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p>Nincs mentett sablon</p>
              </div>
            ) : (
              <div className="space-y-1">
                {(savedTemplates || []).map(saved => (
                  <div key={saved.id} className={`rounded-lg border transition-colors ${selectedTemplate?.id === saved.id ? 'bg-primary/10 border-primary' : 'hover:bg-accent border-transparent'}`}>
                    {renameId === saved.id ? (
                      /* Inline átnevezés */
                      <div className="p-2 flex gap-1">
                        <Input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenameId(null) }}
                          onBlur={commitRename}
                          className="h-7 text-xs"
                        />
                        <Button size="sm" className="h-7 px-2" onClick={commitRename}>
                          <Check className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="p-2 cursor-pointer"
                        onClick={() => handleLoadSavedTemplate(saved)}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs truncate leading-tight">{saved.name}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] py-0 px-1">
                                {saved.data.type === 'cmr' ? 'CMR' : saved.data.type === 'pallet' ? 'Raklap cimke' : saved.data.type === 'box-label' ? 'Etiketta' : 'Szállítólevél'}
                              </Badge>
                              {hasUnsavedChanges && selectedTemplate?.id === saved.id && (
                                <span className="text-[10px] text-amber-500 font-semibold">● módosítva</span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(saved.timestamp).toLocaleDateString('hu-HU')}
                            </div>
                          </div>
                          {/* Akció gombok */}
                          <div className="flex gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Átnevezés" onClick={() => startRename(saved)}>
                              <PencilSimple className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Duplikálás" onClick={() => handleDuplicateTemplate(saved)}>
                              <CopySimple className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive hover:text-destructive" title="Törlés" onClick={() => handleDeleteTemplate(saved.id)}>
                              <Trash className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Jobb oldal: szerkesztő ---- */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base truncate">
                {selectedTemplate?.name || 'Nincs kiválasztott sablon'}
                {hasUnsavedChanges && <span className="text-amber-500 ml-2 text-sm">●</span>}
              </CardTitle>
              <div className="flex gap-1 shrink-0">
                <Button variant={editMode === 'code' ? 'default' : 'outline'} size="sm" onClick={() => setEditMode('code')}>
                  <Code className="w-4 h-4" /><span className="ml-1 hidden sm:inline">Kód</span>
                </Button>
                <Button variant={editMode === 'split' ? 'default' : 'outline'} size="sm" onClick={() => setEditMode('split')}>
                  <SplitVertical className="w-4 h-4" /><span className="ml-1 hidden sm:inline">Osztott</span>
                </Button>
                <Button variant={editMode === 'preview' ? 'default' : 'outline'} size="sm" onClick={() => setEditMode('preview')}>
                  <Eye className="w-4 h-4" /><span className="ml-1 hidden sm:inline">Előnézet</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {!selectedTemplate ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileHtml className="w-12 h-12 mx-auto mb-4 opacity-40" />
                <p>Válassz egy sablont a listából, vagy hozz létre újat</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Mentés + visszaállítás */}
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={handleSaveTemplate} disabled={!hasUnsavedChanges}>
                    <FloppyDisk className="w-4 h-4 mr-2" />Mentés
                    <kbd className="ml-2 text-[10px] opacity-60 hidden sm:inline">Ctrl+S</kbd>
                  </Button>
                  <Button variant="outline" onClick={handleResetToDefault}>
                    <ArrowCounterClockwise className="w-4 h-4 mr-2" />Visszaállítás
                  </Button>
                </div>

                {/* Margó beállítások */}
                <Card className="bg-muted/40">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium shrink-0">Margó (mm):</span>
                      {[
                        { id: 'mt', label: 'F', val: marginTop,    set: setMarginTop },
                        { id: 'mr', label: 'J', val: marginRight,  set: setMarginRight },
                        { id: 'mb', label: 'A', val: marginBottom, set: setMarginBottom },
                        { id: 'ml', label: 'B', val: marginLeft,   set: setMarginLeft },
                      ].map(m => (
                        <div key={m.id} className="flex items-center gap-1">
                          <Label htmlFor={m.id} className="text-xs text-muted-foreground w-4">{m.label}</Label>
                          <Input id={m.id} type="number" min={0} step="0.1" value={m.val} onChange={e => m.set(e.target.value)} className="w-16 h-7 text-xs" />
                        </div>
                      ))}
                      <span className="text-xs text-muted-foreground">· Az előnézetben kék szaggatott vonal jelzi a margókat</span>
                    </div>
                  </CardContent>
                </Card>

                {/* KÓD + ELŐNÉZET főterület */}
                <div className={`grid gap-4 ${editMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {/* Kód szerkesztő */}
                  {(editMode === 'code' || editMode === 'split') && (
                    <div className="space-y-3">
                      {/* Változó panel — A KÓDEDITOR FELETT */}
                      <Card className="border-dashed">
                        <CardHeader className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">Változók</span>
                              <Badge variant="secondary" className="text-[10px]">kattintásra beszúr</Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowReferencePanel(v => !v)}>
                              {showReferencePanel ? <><CaretUp className="w-3 h-3 mr-1" />Elrejt</> : <><CaretDown className="w-3 h-3 mr-1" />Mutat</>}
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Kattints egy változóra → a kurzor pozíciójára szúrja be a <strong>{lastEditorRef.current === 'html' ? 'HTML' : 'CSS'}</strong> szerkesztőbe
                          </p>
                        </CardHeader>
                        {showReferencePanel && (
                          <CardContent className="px-3 pb-3 pt-0">
                            <div className="max-h-52 overflow-y-auto space-y-3 pr-1">
                              {TEMPLATE_VARIABLES.map(group => (
                                <div key={group.group}>
                                  <div className="text-[11px] font-semibold text-primary mb-1">{group.group}</div>
                                  <div className="flex flex-wrap gap-1">
                                    {group.vars.map(v => (
                                      <button
                                        key={v.token}
                                        title={v.label}
                                        onClick={() => insertVariable(v.token)}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors hover:bg-primary hover:text-primary-foreground hover:border-primary
                                          ${(v as any).warn ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-muted border-border'}`}
                                      >
                                        {v.token}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              {/* Ciklus sablon */}
                              <div>
                                <div className="text-[11px] font-semibold text-primary mb-1">🔄 Ciklus sablon</div>
                                <button
                                  onClick={() => insertVariable('{{#items}}\n<tr>\n  <td>{{index}}</td>\n  <td>{{productName}}</td>\n  <td>{{pallets}}</td>\n  <td>{{grossWeight}}</td>\n</tr>\n{{/items}}')}
                                  className="text-[11px] font-mono bg-green-50 border border-green-200 text-green-800 px-2 py-1 rounded hover:bg-green-100 transition-colors w-full text-left"
                                >
                                  {'{{#items}} … {{/items}} (teljes sor sablon)'}
                                </button>
                              </div>
                            </div>
                          </CardContent>
                        )}
                      </Card>

                      {/* HTML textarea */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">HTML</Label>
                        <Textarea
                          ref={htmlTextareaRef}
                          value={htmlContent}
                          onChange={e => setHtmlContent(e.target.value)}
                          onFocus={() => onTextareaFocus('html')}
                          onSelect={e => onTextareaSelect('html', e)}
                          onClick={e => onTextareaSelect('html', e as any)}
                          onKeyUp={e => onTextareaSelect('html', e as any)}
                          className="font-mono text-xs min-h-[300px]"
                          placeholder="HTML kód ide…"
                          spellCheck={false}
                        />
                      </div>

                      {/* CSS textarea */}
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">CSS</Label>
                        <Textarea
                          ref={cssTextareaRef}
                          value={cssContent}
                          onChange={e => setCssContent(e.target.value)}
                          onFocus={() => onTextareaFocus('css')}
                          onSelect={e => onTextareaSelect('css', e)}
                          onClick={e => onTextareaSelect('css', e as any)}
                          onKeyUp={e => onTextareaSelect('css', e as any)}
                          className="font-mono text-xs min-h-[200px]"
                          placeholder="CSS stílusok ide…"
                          spellCheck={false}
                        />
                      </div>

                      {/* Gyorsbillentyűk */}
                      <div className="text-[11px] text-muted-foreground flex gap-3 flex-wrap">
                        <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+S</kbd> Mentés</span>
                        <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+E</kbd> Export</span>
                        <span><kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Ctrl+P</kbd> Előnézet</span>
                      </div>
                    </div>
                  )}

                  {/* Élő előnézet */}
                  {(editMode === 'preview' || editMode === 'split') && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Élő előnézet</Label>
                      <div className="border rounded-lg overflow-hidden bg-white" style={{ minHeight: 700 }}>
                        <iframe
                          ref={previewRef}
                          className="w-full"
                          style={{ height: '700px', border: 'none' }}
                          title="Sablon előnézet"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Dialógusok ---- */}

      {/* Új sablon */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új sablon létrehozása</DialogTitle>
            <DialogDescription>Hozz létre egy új üres sablont a szerkesztőhöz</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sablon neve</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="pl. Egyedi CMR Sablon" />
            </div>
            <div>
              <Label>Típus</Label>
              <Select value={templateType} onValueChange={v => setTemplateType(v as 'cmr' | 'delivery' | 'pallet' | 'box-label')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Szállítólevél</SelectItem>
                  <SelectItem value="cmr">CMR</SelectItem>
                  <SelectItem value="pallet">Raklap cimke</SelectItem>
                  <SelectItem value="box-label">Etiketta (4×10)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Leírás (opcionális)</Label>
              <Textarea value={templateDescription} onChange={e => setTemplateDescription(e.target.value)} placeholder="Sablon leírása…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Mégse</Button>
            <Button onClick={handleCreateNewTemplate}>Létrehozás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sablon importálása</DialogTitle>
            <DialogDescription>Illessz be egy korábban exportált sablon JSON-t, vagy töltsd be fájlból</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.json'
                input.onchange = e => {
                  const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = ev => setImportFileContent(ev.target?.result as string || '')
                  reader.readAsText(file)
                }
                input.click()
              }}>
                <FolderOpen className="w-4 h-4 mr-2" />Fájl megnyitása
              </Button>
            </div>
            <div>
              <Label>JSON tartalom</Label>
              <Textarea value={importFileContent} onChange={e => setImportFileContent(e.target.value)} placeholder='{"name": "Sablon neve", "html": "...", "css": "..."}' className="font-mono text-xs min-h-[200px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Mégse</Button>
            <Button onClick={handleImportTemplate} disabled={!importFileContent.trim()}>Importálás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
