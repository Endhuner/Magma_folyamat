import { useState, useEffect, useRef } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Code, Eye, FloppyDisk, Upload, Download, ArrowCounterClockwise, Clock, FileHtml, SplitVertical, CloudArrowUp, FolderOpen, CaretDown, CaretUp, Copy, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Order, Customer, Product } from '@/lib/types'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface TemplateData {
  id: string
  name: string
  type: 'cmr' | 'delivery'
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

export function GithubStyleTemplateEditor() {
  const [savedTemplates, setSavedTemplates] = useKV<SavedTemplate[]>('saved-templates', [])
  const [orders] = useKV<Order[]>('orders', [])
  const [customers] = useKV<Customer[]>('customers', [])
  const [products] = useKV<Product[]>('products', [])
  const [selectedTemplateId, setSelectedTemplateId] = useKV<string | null>('selected-template-id', null)
  const [draftHtml, setDraftHtml] = useKV<Record<string, string>>('template-draft-html', {})
  const [draftCss, setDraftCss] = useKV<Record<string, string>>('template-draft-css', {})
  
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null)
  const [editMode, setEditMode] = useState<'code' | 'preview' | 'split'>('split')
  const [htmlContent, setHtmlContent] = useState('')
  const [cssContent, setCssContent] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  const [marginTop, setMarginTop] = useState('10')
  const [marginRight, setMarginRight] = useState('10')
  const [marginBottom, setMarginBottom] = useState('10')
  const [marginLeft, setMarginLeft] = useState('10')
  
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [templateType, setTemplateType] = useState<'cmr' | 'delivery'>('delivery')
  
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFileContent, setImportFileContent] = useState('')
  
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const [loadSavedTemplateDialogOpen, setLoadSavedTemplateDialogOpen] = useState(false)
  const [showReferencePanel, setShowReferencePanel] = useState(true)
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)
  
  const previewRef = useRef<HTMLIFrameElement>(null)


  
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
          margins: saved.data.margins
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

  useEffect(() => {
    if (selectedTemplate) {
      setHasUnsavedChanges(
        htmlContent !== selectedTemplate.html || 
        cssContent !== selectedTemplate.css
      )
      
      if (htmlContent !== selectedTemplate.html || cssContent !== selectedTemplate.css) {
        setDraftHtml((current) => ({ ...(current || {}), [selectedTemplate.id]: htmlContent }))
        setDraftCss((current) => ({ ...(current || {}), [selectedTemplate.id]: cssContent }))
      } else {
        setDraftHtml((current) => {
          const updated = { ...(current || {}) }
          delete updated[selectedTemplate.id]
          return updated
        })
        setDraftCss((current) => {
          const updated = { ...(current || {}) }
          delete updated[selectedTemplate.id]
          return updated
        })
      }
    }
  }, [htmlContent, cssContent, selectedTemplate, setDraftHtml, setDraftCss])

  useEffect(() => {
    updatePreview()
  }, [htmlContent, cssContent, editMode, marginTop, marginRight, marginBottom, marginLeft])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (hasUnsavedChanges && selectedTemplate) {
          handleSaveTemplate()
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        if (selectedTemplate) {
          handleExportTemplate()
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        setEditMode('preview')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasUnsavedChanges, selectedTemplate])

  const handleCopyVariable = (variable: string) => {
    navigator.clipboard.writeText(variable).then(() => {
      setCopiedVariable(variable)
      toast.success(`Másolta: ${variable}`)
      setTimeout(() => setCopiedVariable(null), 2000)
    }).catch(() => {
      toast.error('Másolás sikertelen')
    })
  }

  const updatePreview = () => {
    if (!previewRef.current) return
    
    const sampleData = generateSampleData()
    const processedHtml = processTemplate(htmlContent, sampleData)
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            @page {
              margin: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
            }
            body {
              margin: 0;
              padding: ${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;
              position: relative;
            }
            body::before {
              content: "";
              position: fixed;
              top: ${marginTop}mm;
              left: ${marginLeft}mm;
              right: ${marginRight}mm;
              bottom: ${marginBottom}mm;
              border: 2px dashed rgba(59, 130, 246, 0.5);
              pointer-events: none;
              z-index: 9999;
            }
            ${cssContent}
          </style>
        </head>
        <body>
          ${processedHtml}
        </body>
      </html>
    `
    
    const doc = previewRef.current.contentDocument
    if (doc) {
      doc.open()
      doc.write(fullHtml)
      doc.close()
    }
  }

  const generateSampleData = () => {
    const sampleOrders = orders && orders.length > 0 ? orders.slice(0, 3) : [
      {
        orderNumber: 'ORD-001',
        ownOrderNumber: 'VEVO-REF-001',
        customer: 'Példa Cég Kft',
        productName: 'Alkatrész A',
        designation: 'Példa megnevezés 1',
        material: 'Acél',
        amountPc: 100,
        boxesCount: 5,
        palletsCount: 2,
        grossWeightKg: '250'
      },
      {
        orderNumber: 'ORD-002',
        ownOrderNumber: 'VEVO-REF-002',
        customer: 'Példa Cég Kft',
        productName: 'Alkatrész B',
        designation: 'Példa megnevezés 2',
        material: 'Alumínium',
        amountPc: 50,
        boxesCount: 3,
        palletsCount: 1,
        grossWeightKg: '120'
      },
      {
        orderNumber: 'ORD-003',
        ownOrderNumber: 'VEVO-REF-003',
        customer: 'Példa Cég Kft',
        productName: 'Alkatrész C',
        designation: 'Példa megnevezés 3',
        material: 'Műanyag',
        amountPc: 200,
        boxesCount: 10,
        palletsCount: 3,
        grossWeightKg: '180'
      }
    ]

    const sampleCustomer = customers && customers.length > 0 ? customers[0] : {
      name: 'Példa Cég Kft',
      fullAddress: 'Példa utca 123, Budapest, 1234',
      city: 'Budapest',
      postalCode: '1234',
      country: 'Magyarország',
      taxNumber: '12345678-1-23'
    }

    const totalPallets = sampleOrders.reduce((sum, o) => sum + (o.palletsCount || 0), 0)
    const totalWeight = sampleOrders.reduce((sum, o) => sum + (parseFloat(String(o.grossWeightKg || 0)) || 0), 0)
    const totalQuantity = sampleOrders.reduce((sum, o) => sum + (o.amountPc || 0), 0)
    const totalBoxes = sampleOrders.reduce((sum, o) => sum + (o.boxesCount || 0), 0)

    return {
      documentNumber: 'DOC-001',
      sequenceNumber: 'SZ-2024-001',
      senderName: 'Magma Kft',
      senderAddress: 'H-1211 Budapest, Déli utca 13.',
      senderCountry: 'Magyarország',
      senderTaxNumber: 'HU10368152-2-43',
      recipientName: sampleCustomer.name,
      recipientAddress: sampleCustomer.fullAddress,
      recipientCountry: sampleCustomer.country,
      customerName: sampleCustomer.name,
      customerAddress: sampleCustomer.fullAddress,
      customerCity: sampleCustomer.city,
      customerCountry: sampleCustomer.country,
      customerTaxNumber: sampleCustomer.taxNumber,
      pickupLocation: 'Budapest, Hungary',
      deliveryLocation: `${sampleCustomer.city}, ${sampleCustomer.country}`,
      deliveryDate: new Date().toLocaleDateString('hu-HU'),
      issueDate: new Date().toLocaleDateString('hu-HU'),
      referenceNumber: sampleOrders[0].ownOrderNumber,
      orderNumber: sampleOrders[0].orderNumber || 'N/A',
      ownOrderNumber: sampleOrders[0].ownOrderNumber || 'N/A',
      productName: sampleOrders[0].productName,
      items: sampleOrders.map((order, idx) => ({
        index: (idx + 1).toString(),
        designation: order.designation || order.productName,
        productName: order.productName,
        quantity: order.amountPc?.toString() || '0',
        packaging: `${order.boxesCount || 0} doboz`,
        boxes: order.boxesCount?.toString() || '0',
        pallets: order.palletsCount?.toString() || '0',
        weight: order.grossWeightKg || '0',
        referenceNumber: order.ownOrderNumber || 'N/A',
        orderNumber: order.orderNumber || 'N/A',
        ownOrderNumber: order.ownOrderNumber || 'N/A'
      })),
      totalQuantity: totalQuantity.toString(),
      totalBoxes: totalBoxes.toString(),
      totalPallets: totalPallets.toString(),
      totalWeight: totalWeight.toFixed(2)
    }
  }

  const processTemplate = (html: string, data: any): string => {
    let processed = html

    Object.keys(data).forEach(key => {
      if (Array.isArray(data[key])) {
        const itemsRegex = new RegExp(`{{#${key}}}([\\s\\S]*?){{/${key}}}`, 'g')
        processed = processed.replace(itemsRegex, (match, template) => {
          return data[key].map((item: any) => {
            let itemHtml = template
            Object.keys(item).forEach(itemKey => {
              itemHtml = itemHtml.replace(new RegExp(`{{${itemKey}}}`, 'g'), item[itemKey])
            })
            return itemHtml
          }).join('')
        })
      } else {
        processed = processed.replace(new RegExp(`{{${key}}}`, 'g'), data[key] || '')
      }
    })

    return processed
  }

  const handleSaveTemplate = () => {
    if (!selectedTemplate) {
      toast.error('Nincs kiválasztott sablon')
      return
    }

    const currentHtml = htmlContent.trim()
    const currentCss = cssContent.trim()

    if (!currentHtml || currentHtml === '') {
      toast.error('A HTML sablon nem lehet üres')
      return
    }

    const templateData: TemplateData = {
      id: selectedTemplate.id,
      name: selectedTemplate.name,
      type: selectedTemplate.type,
      html: currentHtml,
      css: currentCss,
      timestamp: new Date().toISOString(),
      description: selectedTemplate.description,
      margins: {
        top: marginTop,
        right: marginRight,
        bottom: marginBottom,
        left: marginLeft
      }
    }

    setSavedTemplates((current) => {
      const existing = (current || []).find(s => s.id === selectedTemplateId)
      
      if (existing) {
        return (current || []).map(s => 
          s.id === selectedTemplateId
            ? {
                ...s,
                name: s.name,
                timestamp: new Date().toISOString(),
                size: JSON.stringify(templateData).length,
                data: {
                  ...templateData,
                  id: s.id
                }
              }
            : s
        )
      } else {
        const saveName = `${selectedTemplate.name} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`
        const newTemplateId = Date.now().toString()
        const newSave: SavedTemplate = {
          id: newTemplateId,
          name: saveName,
          timestamp: new Date().toISOString(),
          size: JSON.stringify(templateData).length,
          data: {
            ...templateData,
            id: newTemplateId
          }
        }
        setSelectedTemplateId(newTemplateId)
        setSelectedTemplate({
          ...templateData,
          id: newTemplateId,
          name: saveName
        })
        return [newSave, ...(current || [])]
      }
    })
    
    setDraftHtml((current) => {
      const updated = { ...(current || {}) }
      delete updated[selectedTemplate.id]
      if (selectedTemplateId) {
        delete updated[selectedTemplateId]
      }
      return updated
    })
    setDraftCss((current) => {
      const updated = { ...(current || {}) }
      delete updated[selectedTemplate.id]
      if (selectedTemplateId) {
        delete updated[selectedTemplateId]
      }
      return updated
    })
    
    setHasUnsavedChanges(false)
    toast.success('Sablon sikeresen frissítve')
  }

  const handleCreateNewTemplate = () => {
    if (!templateName.trim()) {
      toast.error('Add meg a sablon nevét')
      return
    }

    const newTemplateId = `template-${Date.now()}`
    
    const newTemplateData: TemplateData = {
      id: newTemplateId,
      name: templateName,
      type: templateType,
      html: templateType === 'cmr' ? DEFAULT_CMR_HTML : DEFAULT_DELIVERY_HTML,
      css: templateType === 'cmr' ? DEFAULT_CMR_CSS : DEFAULT_DELIVERY_CSS,
      timestamp: new Date().toISOString(),
      description: templateDescription
    }

    const saveName = `${templateName} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`

    const newSave: SavedTemplate = {
      id: newTemplateId,
      name: saveName,
      timestamp: new Date().toISOString(),
      size: JSON.stringify(newTemplateData).length,
      data: newTemplateData
    }

    setSavedTemplates((current) => [newSave, ...(current || [])])
    
    setSelectedTemplate(newTemplateData)
    setSelectedTemplateId(newTemplateId)
    setHtmlContent(newTemplateData.html)
    setCssContent(newTemplateData.css)
    
    setTemplateName('')
    setTemplateDescription('')
    setSaveDialogOpen(false)
    toast.success('Új sablon létrehozva és mentve a Sablon Mentésekbe')
  }

  const handleLoadTemplate = (template: TemplateData) => {
    if (hasUnsavedChanges) {
      if (!confirm('Van mentetlen módosítás. Biztosan betöltöd a sablont?')) {
        return
      }
    }
    
    setSelectedTemplate(template)
    setSelectedTemplateId(template.id)
    setHtmlContent(template.html)
    setCssContent(template.css)
    setHasUnsavedChanges(false)
    toast.success(`Sablon betöltve: ${template.name}`)
  }

  const handleExportTemplate = () => {
    if (!selectedTemplate) return

    const exportData = {
      name: selectedTemplate.name,
      type: selectedTemplate.type,
      html: htmlContent,
      css: cssContent,
      description: selectedTemplate.description,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedTemplate.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success('Sablon exportálva')
  }

  const handleImportTemplate = () => {
    try {
      const importedData = JSON.parse(importFileContent)
      
      if (!importedData.html || !importedData.css) {
        toast.error('Érvénytelen sablon formátum')
        return
      }

      const newTemplateId = `template-${Date.now()}`
      
      const newTemplateData: TemplateData = {
        id: newTemplateId,
        name: importedData.name || 'Importált Sablon',
        type: importedData.type || 'delivery',
        html: importedData.html,
        css: importedData.css,
        timestamp: new Date().toISOString(),
        description: importedData.description || ''
      }

      const saveName = `${newTemplateData.name} - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`

      const newSave: SavedTemplate = {
        id: newTemplateId,
        name: saveName,
        timestamp: new Date().toISOString(),
        size: JSON.stringify(newTemplateData).length,
        data: newTemplateData
      }

      setSavedTemplates((current) => [newSave, ...(current || [])])
      
      setSelectedTemplate(newTemplateData)
      setSelectedTemplateId(newTemplateId)
      setHtmlContent(newTemplateData.html)
      setCssContent(newTemplateData.css)
      
      setImportFileContent('')
      setImportDialogOpen(false)
      toast.success('Sablon importálva és mentve a Sablon Mentésekbe')
    } catch (error) {
      toast.error('Hiba a sablon importálása során')
    }
  }

  const handleDeleteTemplate = (id: string) => {
    if (!confirm('Biztosan törölni szeretnéd ezt a sablont?')) return

    setSavedTemplates((current) => {
      const filtered = (current || []).filter(t => t.id !== id)
      if (selectedTemplate?.id === id) {
        const newSelected = filtered[0] || null
        if (newSelected) {
          handleLoadSavedTemplate(newSelected)
        } else {
          setSelectedTemplate(null)
          setSelectedTemplateId(null)
          setHtmlContent('')
          setCssContent('')
        }
      }
      return filtered
    })
    
    toast.success('Sablon törölve')
  }

  const handleResetToDefault = () => {
    if (!confirm('Biztosan visszaállítod az alapértelmezett sablont? A jelenlegi módosítások elvesznek.')) return

    const defaultHtml = selectedTemplate?.type === 'cmr' ? DEFAULT_CMR_HTML : DEFAULT_DELIVERY_HTML
    const defaultCss = selectedTemplate?.type === 'cmr' ? DEFAULT_CMR_CSS : DEFAULT_DELIVERY_CSS
    
    setHtmlContent(defaultHtml)
    setCssContent(defaultCss)
    toast.success('Alapértelmezett sablon visszaállítva')
  }

  const handleLoadSavedTemplate = (saved: SavedTemplate) => {
    if (hasUnsavedChanges) {
      if (!confirm('Van mentetlen módosítás. Biztosan betöltöd a sablont?')) {
        return
      }
    }

    const templateToEdit: TemplateData = {
      id: saved.id,
      name: saved.name,
      type: saved.data.type,
      html: saved.data.html,
      css: saved.data.css,
      timestamp: saved.timestamp,
      description: saved.data.description
    }
    
    setSelectedTemplate(templateToEdit)
    setSelectedTemplateId(saved.id)
    
    const hasDraft = draftHtml && draftHtml[saved.id]
    if (hasDraft) {
      setHtmlContent(draftHtml[saved.id] || saved.data.html)
      setCssContent((draftCss || {})[saved.id] || saved.data.css)
    } else {
      setHtmlContent(saved.data.html)
      setCssContent(saved.data.css)
    }
    
    setHasUnsavedChanges(false)
    setLoadSavedTemplateDialogOpen(false)
    toast.success(`Sablon betöltve: ${saved.name}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Sablon Szerkesztő</h2>
          <p className="text-muted-foreground">GitHub-stílusú HTML/CSS sablon szerkesztő</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSaveDialogOpen(true)}>
            <FileHtml className="w-4 h-4 mr-2" />
            Új Sablon
          </Button>
          <Button variant="outline" onClick={() => setLoadSavedTemplateDialogOpen(true)}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Sablon Mentések
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importálás
          </Button>
          <Button variant="outline" onClick={handleExportTemplate} disabled={!selectedTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Exportálás
          </Button>
          <Button variant="outline" onClick={() => setHistoryDialogOpen(true)}>
            <Clock className="w-4 h-4 mr-2" />
            Előzmények
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Mentett Sablonok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {(savedTemplates || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nincs mentett sablon</p>
                <p className="text-xs mt-2">Mentsd el a sablonjaidat a "Mentés" gombbal</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(savedTemplates || []).map((saved) => (
                  <div
                    key={saved.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedTemplate?.id === saved.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-accent'
                    }`}
                    onClick={() => handleLoadSavedTemplate(saved)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{saved.name}</div>
                        <Badge variant="outline" className="text-xs mt-1">
                          {saved.data.type === 'cmr' ? 'CMR' : 'Szállítólevél'}
                        </Badge>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(saved.timestamp).toLocaleDateString('hu-HU')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedTemplate?.name || 'Nincs kiválasztott sablon'}
                {hasUnsavedChanges && <span className="text-warning ml-2">*</span>}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={editMode === 'code' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode('code')}
                >
                  <Code className="w-4 h-4 mr-2" />
                  Kód
                </Button>
                <Button
                  variant={editMode === 'split' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode('split')}
                >
                  <SplitVertical className="w-4 h-4 mr-2" />
                  Osztott
                </Button>
                <Button
                  variant={editMode === 'preview' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode('preview')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Előnézet
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTemplate ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileHtml className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Válassz ki vagy hozz létre egy sablont a szerkesztéshez</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleSaveTemplate} disabled={!hasUnsavedChanges}>
                    <FloppyDisk className="w-4 h-4 mr-2" />
                    Mentés
                  </Button>
                  <Button variant="outline" onClick={handleResetToDefault}>
                    <ArrowCounterClockwise className="w-4 h-4 mr-2" />
                    Alapértelmezett visszaállítása
                  </Button>
                </div>

                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">Margó Beállítások (mm)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="margin-top" className="text-sm">Felső</Label>
                        <Input
                          id="margin-top"
                          type="number"
                          step="0.1"
                          value={marginTop}
                          onChange={(e) => setMarginTop(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="margin-right" className="text-sm">Jobb</Label>
                        <Input
                          id="margin-right"
                          type="number"
                          step="0.1"
                          value={marginRight}
                          onChange={(e) => setMarginRight(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="margin-bottom" className="text-sm">Alsó</Label>
                        <Input
                          id="margin-bottom"
                          type="number"
                          step="0.1"
                          value={marginBottom}
                          onChange={(e) => setMarginBottom(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="margin-left" className="text-sm">Bal</Label>
                        <Input
                          id="margin-left"
                          type="number"
                          step="0.1"
                          value={marginLeft}
                          onChange={(e) => setMarginLeft(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3">
                      <strong className="text-blue-600 dark:text-blue-400">💡 Vizualizáció:</strong> Az előnézetben a margók kék szaggatott vonalakkal vannak jelölve. Ez segít ellenőrizni a beállításokat az export előtt.
                    </div>
                  </CardContent>
                </Card>

                <div className={`grid gap-4 ${editMode === 'split' ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>
                  {(editMode === 'code' || editMode === 'split') && (
                    <div className="space-y-4">
                      <div>
                        <Label>HTML Sablon</Label>
                        <Textarea
                          value={htmlContent}
                          onChange={(e) => setHtmlContent(e.target.value)}
                          className="font-mono text-sm min-h-[400px] mt-2"
                          placeholder="HTML kód ide..."
                        />
                      </div>
                      <div>
                        <Label>CSS Stílusok</Label>
                        <Textarea
                          value={cssContent}
                          onChange={(e) => setCssContent(e.target.value)}
                          className="font-mono text-sm min-h-[300px] mt-2"
                          placeholder="CSS kód ide..."
                        />
                      </div>
                    </div>
                  )}

                  {(editMode === 'preview' || editMode === 'split') && (
                    <div>
                      <Label>Élő Előnézet</Label>
                      <div className="border rounded-lg overflow-hidden mt-2 bg-white" style={{ minHeight: '400px' }}>
                        <iframe
                          ref={previewRef}
                          className="w-full h-full"
                          style={{ minHeight: '700px', border: 'none' }}
                          title="Sablon előnézet"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Card className="bg-accent/10 border-accent/30">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">Használható változók</CardTitle>
                        <Badge variant="default" className="text-xs">Egységes elnevezések!</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowReferencePanel(!showReferencePanel)}
                        className="gap-2"
                      >
                        {showReferencePanel ? (
                          <>
                            <CaretUp className="w-4 h-4" />
                            Elrejtés
                          </>
                        ) : (
                          <>
                            <CaretDown className="w-4 h-4" />
                            Megjelenítés
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                      <strong className="text-blue-700">💡 FONTOS:</strong> Minden változó név <strong>UGYANAZ</strong> a CMR, Szállítólevél és Címke sablonokban is!
                      A teljes dokumentációért lásd a <code className="bg-white px-1 rounded">SABLON_VALTOZOK.md</code> fájlt a projekt gyökerében.
                    </div>
                  </CardHeader>
                  {showReferencePanel && (
                    <CardContent>
                    <div className="text-sm space-y-3 max-h-[600px] overflow-y-auto pr-2">
                      <div className="p-3 bg-accent/20 border border-accent/40 rounded-lg">
                        <div className="font-semibold text-sm mb-2 flex items-center gap-2">
                          ⌨️ Gyorsbillentyűk
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <kbd className="px-2 py-1 bg-muted rounded">Ctrl + S</kbd>
                            <span className="text-muted-foreground">Sablon mentése</span>
                          </div>
                          <div className="flex justify-between">
                            <kbd className="px-2 py-1 bg-muted rounded">Ctrl + E</kbd>
                            <span className="text-muted-foreground">Sablon exportálása</span>
                          </div>
                          <div className="flex justify-between">
                            <kbd className="px-2 py-1 bg-muted rounded">Ctrl + P</kbd>
                            <span className="text-muted-foreground">Előnézet mód</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-muted-foreground mb-3">
                        Használd ezeket a kódokat a sablonban az adatok automatikus kitöltéséhez. Kattints a <Copy className="w-3 h-3 inline mx-1" /> ikonra a változó másolásához.
                      </div>
                      
                      <div className="space-y-2">
                        <div className="font-semibold text-primary mb-2">📄 Dokumentum adatok:</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-center gap-2 group">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded flex-shrink-0">{'{{sequenceNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1">Dokumentum sorszáma</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyVariable('{{sequenceNumber}}')}
                            >
                              {copiedVariable === '{{sequenceNumber}}' ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex justify-between items-center gap-2 group">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded flex-shrink-0">{'{{documentNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1">Ugyanaz mint sequenceNumber</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyVariable('{{documentNumber}}')}
                            >
                              {copiedVariable === '{{documentNumber}}' ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex justify-between items-center gap-2 group">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded flex-shrink-0">{'{{issueDate}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1">Mai dátum (kiállítás)</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyVariable('{{issueDate}}')}
                            >
                              {copiedVariable === '{{issueDate}}' ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                          <div className="flex justify-between items-center gap-2 group">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded flex-shrink-0">{'{{deliveryDate}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1">Szállítási dátum</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyVariable('{{deliveryDate}}')}
                            >
                              {copiedVariable === '{{deliveryDate}}' ? (
                                <Check className="w-3 h-3 text-success" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="font-semibold text-primary mb-2">🏢 Feladó adatok (CMR beállításokból):</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{senderName}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Feladó neve</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{senderAddress}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Feladó címe</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{senderCity}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Feladó városa</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{senderCountry}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Feladó országa</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{senderTaxNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Feladó adószáma</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="font-semibold text-primary mb-2">👤 Vevő adatok (Vevők táblázatból):</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{customerName}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Vevő neve</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{customerAddress}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Vevő teljes címe</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{customerCity}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Vevő városa</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{customerCountry}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Vevő országa</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{customerTaxNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Vevő adószáma</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="font-semibold text-primary mb-2">🚚 Szállítás adatok:</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{carrierName}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Fuvarozó neve</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{carrierAddress}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Fuvarozó címe</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{vehiclePlate}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Jármű rendszáma</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{pickupLocation}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Átvétel helye</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{deliveryLocation}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Szállítás helye</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2 border-t pt-3">
                        <div className="font-semibold text-primary mb-2">📦 Rendelés adatok (csak cikluson KÍVÜL - első rendelés):</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">{'{{ownOrderNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right"><strong>Saját rendelési szám</strong> (első)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded font-semibold">{'{{orderNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right"><strong>Vevő rendelési száma</strong> (első)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{productName}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Termék neve (első)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{designation}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Termék megnevezése (első)</span>
                          </div>
                        </div>
                        <div className="text-xs text-amber-700 mt-2 ml-3 p-2 bg-amber-50 rounded border border-amber-200">
                          ⚠️ <strong>Figyelem:</strong> Több rendelés esetén ezek csak az <strong>első rendelés</strong> adatait mutatják!<br/>
                          Ha minden rendeléshez egyedi értéket akarsz, használd a <code className="bg-white px-1 rounded">{'{{#items}}'}</code> ciklust!
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <div className="font-semibold text-primary mb-2">🔢 Összesítő adatok (több rendelés esetén):</div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{totalQuantity}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Összes mennyiség (db)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{totalBoxes}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Összes doboz (db)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{totalPallets}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Összes raklap (db)</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{totalWeight}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Összes bruttó súly (kg)</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="font-semibold text-primary mb-2">🔄 Items Ciklus - Minden rendeléshez EGYEDI érték:</div>
                        <div className="ml-3 space-y-2">
                          <div className="text-xs bg-green-50 border border-green-200 p-3 rounded font-mono leading-relaxed">
                            {'<table>'}
                            <br />
                            {'  <tbody>'}
                            <br />
                            {'    {{#items}}'}
                            <br />
                            {'    <tr>'}
                            <br />
                            {'      <td>{{index}}</td>'}
                            <br />
                            {'      <td>{{ownOrderNumber}}</td>'}
                            <br />
                            {'      <td>{{productName}}</td>'}
                            <br />
                            {'      <td>{{quantity}}</td>'}
                            <br />
                            {'      <td>{{weight}}</td>'}
                            <br />
                            {'    </tr>'}
                            <br />
                            {'    {{/items}}'}
                            <br />
                            {'  </tbody>'}
                            <br />
                            {'</table>'}
                          </div>
                          <div className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                            ✅ <strong>A cikluson BELÜL</strong> minden változó minden rendeléshez <strong>egyedi értéket ad!</strong>
                          </div>
                          <div className="text-xs space-y-1.5 bg-white p-3 rounded border">
                            <div className="font-semibold mb-2 text-foreground">Cikluson belül elérhető változók:</div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{index}}'}</code> <span className="text-muted-foreground">Sorszám (1, 2, 3...)</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-semibold">{'{{ownOrderNumber}}'}</code> <span className="font-semibold">Saját rendelési szám ✅</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-semibold">{'{{orderNumber}}'}</code> <span className="font-semibold">Vevő rendelési száma ✅</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{productName}}'}</code> <span className="text-muted-foreground">Termék név</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{designation}}'}</code> <span className="text-muted-foreground">Megnevezés</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{quantity}}'}</code> <span className="text-muted-foreground">Mennyiség (db)</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{boxes}}'}</code> <span className="text-muted-foreground">Dobozok száma</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{pallets}}'}</code> <span className="text-muted-foreground">Raklapok száma</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{weight}}'}</code> <span className="text-muted-foreground">Bruttó súly (kg)</span></div>
                            <div>• <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{'{{packaging}}'}</code> <span className="text-muted-foreground">Csomagolás típusa</span></div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-3 border-t">
                        <div className="font-semibold text-primary mb-2">📊 Termék adatok (Termékek táblázatból - auto):</div>
                        <div className="text-xs text-muted-foreground ml-3 mb-2 p-2 bg-blue-50 rounded border border-blue-200">
                          Ezek automatikusan kikeresésre kerülnek a Termékek táblázatból, ha a rendelés termék neve egyezik.
                        </div>
                        <div className="grid grid-cols-1 gap-1.5 ml-3">
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{drawingNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Rajzszám</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{articleNumber}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Cikkszám</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{piecesPerBox}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Darab/doboz</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{boxesPerPallet}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Doboz/raklap</span>
                          </div>
                          <div className="flex justify-between items-start gap-2">
                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{'{{weightPerPiece}}'}</code>
                            <span className="text-xs text-muted-foreground flex-1 text-right">Darabsúly (kg)</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 p-3 bg-primary/5 rounded border border-primary/20">
                        <div className="text-xs font-semibold text-primary mb-2">
                          📘 Teljes dokumentáció
                        </div>
                        <div className="text-xs text-muted-foreground">
                          A teljes sablon változó dokumentációt a projekt gyökerében található 
                          <code className="bg-white px-1 mx-1 rounded font-mono">SABLON_VALTOZOK.md</code> 
                          fájlban találod, amely tartalmazza az összes használható változót CMR, Szállítólevél és Címke sablonokhoz.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  )}
                </Card>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Új Sablon Létrehozása</DialogTitle>
            <DialogDescription>
              Hozz létre egy új sablon fájlt az alapértelmezett szerkezettel
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sablon neve</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="pl. Egyedi CMR Sablon"
              />
            </div>
            <div>
              <Label>Típus</Label>
              <Select value={templateType} onValueChange={(v) => setTemplateType(v as 'cmr' | 'delivery')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delivery">Szállítólevél</SelectItem>
                  <SelectItem value="cmr">CMR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Leírás (opcionális)</Label>
              <Textarea
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                placeholder="Sablon leírása..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleCreateNewTemplate}>Létrehozás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sablon Importálása</DialogTitle>
            <DialogDescription>
              Illessz be egy korábban exportált sablon JSON fájlt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>JSON tartalom</Label>
              <Textarea
                value={importFileContent}
                onChange={(e) => setImportFileContent(e.target.value)}
                placeholder='{"name": "Sablon neve", "html": "...", "css": "..."}'
                className="font-mono text-sm min-h-[300px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleImportTemplate}>Importálás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sablon Előzmények</DialogTitle>
            <DialogDescription>
              Mentett sablonok és időpontjaik
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(savedTemplates || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nincs mentett sablon</p>
              </div>
            ) : (
              (savedTemplates || []).map((saved) => (
                <div
                  key={saved.id}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer"
                  onClick={() => {
                    handleLoadSavedTemplate(saved)
                    setHistoryDialogOpen(false)
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">{saved.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {saved.data.type === 'cmr' ? 'CMR' : 'Szállítólevél'}
                      </div>
                      {saved.data.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {saved.data.description}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(saved.timestamp).toLocaleString('hu-HU')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadSavedTemplateDialogOpen} onOpenChange={setLoadSavedTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sablon betöltése a Sablon Mentésekből</DialogTitle>
            <DialogDescription>
              Válassz egy mentett sablont a betöltéshez
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(savedTemplates || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nincs mentett sablon</p>
                <p className="text-sm mt-2">Mentsd el a sablonjaidat a "Mentés Sablon Mentésekbe" gombbal</p>
              </div>
            ) : (
              (savedTemplates || []).map((saved) => (
                <div
                  key={saved.id}
                  className="p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => handleLoadSavedTemplate(saved)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-medium">{saved.name}</div>
                        <Badge variant="outline">
                          {saved.data.type === 'cmr' ? 'CMR' : 'Szállítólevél'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(saved.timestamp).toLocaleString('hu-HU')}
                      </div>
                      {saved.data.description && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {saved.data.description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoadSavedTemplateDialogOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
