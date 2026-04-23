import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Trash, PencilSimple, Plus, FileCsv, Download, CheckCircle, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'

interface Template {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  description: string
  fileName?: string
  fileSize?: number
  fileData?: string
  version?: number
  isActive?: boolean
  createdAt: string
  updatedAt: string
}

const DEFAULT_TEMPLATES = [
  {
    id: 'default-cmr',
    name: 'Cmr',
    type: 'cmr' as const,
    description: 'Alapértelmezett CMR sablon - rendszer által biztosított',
    fileName: 'Cmr.xls',
    version: 1,
    isActive: true,
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export function TemplateManager() {
  const [templates, setTemplates] = useKV<Template[]>('document-templates', [])
  const [defaultsLoaded, setDefaultsLoaded] = useKV<boolean>('defaults-loaded', false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'delivery' as 'delivery' | 'cmr',
    description: ''
  })

  useEffect(() => {
    if (!defaultsLoaded && (templates || []).length === 0) {
      const loadDefaults = async () => {
        for (const template of DEFAULT_TEMPLATES) {
          try {
            const response = await fetch(`/templates/${template.fileName}`)
            if (response.ok) {
              const blob = await response.blob()
              const reader = new FileReader()
              reader.onload = (e) => {
                const fileData = e.target?.result as string
                setTemplates((current) => [...(current || []), {
                  ...template,
                  fileData,
                  fileSize: blob.size
                } as Template])
              }
              reader.readAsDataURL(blob)
            }
          } catch (error) {
            console.error(`Failed to load default template ${template.fileName}:`, error)
          }
        }
        setDefaultsLoaded(true)
        toast.success('Alapértelmezett sablonok betöltve')
      }
      loadDefaults()
    }
  }, [defaultsLoaded, templates, setTemplates, setDefaultsLoaded])

  const handleOpenNew = () => {
    setSelectedTemplate(null)
    setFormData({ name: '', type: 'delivery', description: '' })
    setDialogOpen(true)
  }

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      description: template.description
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('A sablon neve kötelező')
      return
    }

    if (selectedTemplate) {
      setTemplates((current) =>
        (current || []).map((t) =>
          t.id === selectedTemplate.id
            ? { ...t, ...formData, updatedAt: new Date().toISOString() }
            : t
        )
      )
      toast.success('Sablon frissítve')
    } else {
      const newTemplate: Template = {
        id: `template-${Date.now()}`,
        ...formData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setTemplates((current) => [...(current || []), newTemplate])
      toast.success('Sablon létrehozva')
    }

    setDialogOpen(false)
    setSelectedTemplate(null)
    setFormData({ name: '', type: 'delivery', description: '' })
  }

  const handleDelete = (id: string) => {
    setTemplates((current) => (current || []).filter((t) => t.id !== id))
    toast.success('Sablon törölve')
  }

  const handleFileUpload = (type: 'delivery' | 'cmr') => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.xlsx,.xls,.xltx'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        try {
          const reader = new FileReader()
          reader.onload = (event) => {
            const fileData = event.target?.result as string
            
            const existingTemplates = templates?.filter(t => t.type === type && t.name === file.name.replace(/\.(xlsx|xls|xltx)$/i, '')) || []
            const version = existingTemplates.length > 0 ? Math.max(...existingTemplates.map(t => t.version || 1)) + 1 : 1
            
            if (existingTemplates.length > 0) {
              setTemplates((current) =>
                (current || []).map((t) =>
                  t.type === type && t.name === file.name.replace(/\.(xlsx|xls|xltx)$/i, '')
                    ? { ...t, isActive: false }
                    : t
                )
              )
            }
            
            const newTemplate: Template = {
              id: `template-${Date.now()}`,
              name: file.name.replace(/\.(xlsx|xls|xltx)$/i, ''),
              type,
              description: `Feltöltve: ${format(new Date(), 'yyyy. MM. dd. HH:mm', { locale: hu })}`,
              fileName: file.name,
              fileSize: file.size,
              fileData,
              version,
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            setTemplates((current) => [...(current || []), newTemplate])
            toast.success(
              <div className="flex flex-col gap-1">
                <p className="font-medium">Sablon feltöltve: {file.name}</p>
                <p className="text-xs text-muted-foreground">
                  Verzió: {version} • Méret: {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>,
              { duration: 4000 }
            )
          }
          reader.readAsDataURL(file)
        } catch (error) {
          console.error('File upload error:', error)
          toast.error('Hiba történt a fájl feltöltése során')
        }
      }
    }
    input.click()
  }

  const handleDownloadTemplate = (template: Template) => {
    if (!template.fileData) {
      toast.error('A sablon fájl nem érhető el')
      return
    }
    
    try {
      const link = document.createElement('a')
      link.href = template.fileData
      link.download = template.fileName || `${template.name}.xlsx`
      link.click()
      toast.success(`Sablon letöltve: ${template.fileName}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Hiba történt a letöltés során')
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template)
    setPreviewOpen(true)
  }

  const handleActivateVersion = (template: Template) => {
    setTemplates((current) =>
      (current || []).map((t) =>
        t.name === template.name && t.type === template.type
          ? { ...t, isActive: t.id === template.id }
          : t
      )
    )
    toast.success(`v${template.version || 1} aktív verzióként beállítva`)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Sablonok kezelése</h2>
            <p className="text-muted-foreground">
              Szállítólevél és CMR dokumentum sablonok létrehozása és szerkesztése
            </p>
          </div>
          <Button onClick={handleOpenNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Új sablon
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="w-8 h-8 text-primary" weight="duotone" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">Szállítólevél sablon</h3>
                  {(templates || []).some(t => t.type === 'delivery' && t.isActive) && (
                    <Badge variant="default" className="text-xs bg-success text-success-foreground">
                      Aktív
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {(templates || []).find(t => t.type === 'delivery' && t.isActive)?.fileName || 'Nincs aktív sablon'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleFileUpload('delivery')} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Feltöltés
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-secondary/10 rounded-lg">
                <FileCsv className="w-8 h-8 text-secondary" weight="duotone" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">CMR sablon</h3>
                  {(templates || []).some(t => t.type === 'cmr' && t.isActive) && (
                    <Badge variant="default" className="text-xs bg-success text-success-foreground">
                      Aktív
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {(templates || []).find(t => t.type === 'cmr' && t.isActive)?.fileName || 'Nincs aktív sablon'}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleFileUpload('cmr')} className="gap-2">
                    <Upload className="w-4 h-4" />
                    Feltöltés
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {(templates || []).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-4">Feltöltött sablonok</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(templates || []).map((template) => (
                <Card key={template.id} className={`p-4 ${template.isActive ? 'ring-2 ring-success' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {template.type === 'delivery' ? (
                        <FileText className="w-5 h-5 text-primary" weight="duotone" />
                      ) : (
                        <FileCsv className="w-5 h-5 text-secondary" weight="duotone" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{template.name}</h4>
                          {template.isActive && (
                            <Badge variant="default" className="text-xs bg-success text-success-foreground">
                              Aktív
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={template.type === 'delivery' ? 'default' : 'secondary'} className="text-xs">
                            {template.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                          </Badge>
                          {template.version && (
                            <Badge variant="outline" className="text-xs">
                              v{template.version}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.description || 'Nincs leírás'}
                  </p>
                  {template.fileName && (
                    <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-success" weight="fill" />
                      <span className="truncate">{template.fileName}</span>
                      <span className="ml-auto flex-shrink-0">{formatFileSize(template.fileSize)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(template.updatedAt), 'yyyy. MM. dd.', { locale: hu })}
                    </span>
                    <div className="flex gap-1">
                      {template.fileName && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDownloadTemplate(template)}
                          title="Letöltés"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePreview(template)}
                        title="Előnézet"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(template)}
                        title="Szerkesztés"
                      >
                        <PencilSimple className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        title="Törlés"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {(templates || []).length === 0 && (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" weight="duotone" />
            <h3 className="text-lg font-semibold mb-2">Nincs egyéni sablon</h3>
            <p className="text-muted-foreground mb-4">
              Hozzon létre új sablont a dokumentumok testreszabásához
            </p>
            <Button onClick={handleOpenNew} className="gap-2">
              <Plus className="w-4 h-4" />
              Első sablon létrehozása
            </Button>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Sablon szerkesztése' : 'Új sablon létrehozása'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="template-name">Sablon neve *</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="pl. Egyedi szállítólevél sablon"
              />
            </div>

            <div>
              <Label htmlFor="template-type">Típus</Label>
              <select
                id="template-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'delivery' | 'cmr' })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="delivery">Szállítólevél</option>
                <option value="cmr">CMR</option>
              </select>
            </div>

            <div>
              <Label htmlFor="template-description">Leírás</Label>
              <Textarea
                id="template-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Sablon leírása..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSave}>
              {selectedTemplate ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Sablon előnézet: {selectedTemplate?.name}</DialogTitle>
          </DialogHeader>

          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Típus</p>
                  <Badge variant={selectedTemplate.type === 'delivery' ? 'default' : 'secondary'}>
                    {selectedTemplate.type === 'delivery' ? 'Szállítólevél' : 'CMR'}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Verzió</p>
                  <p className="font-semibold">v{selectedTemplate.version || 1}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fájlnév</p>
                  <p className="font-mono text-sm">{selectedTemplate.fileName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Méret</p>
                  <p className="font-mono text-sm">{formatFileSize(selectedTemplate.fileSize)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Létrehozva</p>
                  <p className="text-sm">{format(new Date(selectedTemplate.createdAt), 'yyyy. MM. dd. HH:mm', { locale: hu })}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Utoljára módosítva</p>
                  <p className="text-sm">{format(new Date(selectedTemplate.updatedAt), 'yyyy. MM. dd. HH:mm', { locale: hu })}</p>
                </div>
                {selectedTemplate.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Leírás</p>
                    <p className="text-sm">{selectedTemplate.description}</p>
                  </div>
                )}
              </div>

              {selectedTemplate.version && selectedTemplate.version > 1 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Verzió előzmények</h4>
                  <div className="space-y-2">
                    {(templates || [])
                      .filter(t => t.name === selectedTemplate.name && t.type === selectedTemplate.type)
                      .sort((a, b) => (b.version || 1) - (a.version || 1))
                      .map((versionTemplate) => (
                        <div key={versionTemplate.id} className="flex items-center justify-between p-2 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">v{versionTemplate.version || 1}</Badge>
                            <span className="text-sm">
                              {format(new Date(versionTemplate.createdAt), 'yyyy. MM. dd. HH:mm', { locale: hu })}
                            </span>
                            {versionTemplate.isActive && (
                              <Badge variant="default" className="text-xs bg-success text-success-foreground">
                                Aktív
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {!versionTemplate.isActive && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleActivateVersion(versionTemplate)}
                                className="bg-success text-success-foreground"
                              >
                                <CheckCircle className="w-4 h-4 mr-1" />
                                Aktiválás
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadTemplate(versionTemplate)}
                              disabled={!versionTemplate.fileData}
                            >
                              <Download className="w-4 h-4 mr-1" />
                              Letöltés
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="bg-muted p-8 rounded-lg text-center">
                <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" weight="duotone" />
                <p className="text-muted-foreground text-sm">
                  {selectedTemplate.fileData 
                    ? 'A sablon fájl elmentve és letölthető' 
                    : 'A sablon fájl tartalma nem érhető el'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Bezárás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
