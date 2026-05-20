import { useState } from 'react'
import { useKV } from '@/hooks/useKV'
import { useServerCrud } from '@/lib/providers/useServerCrud'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FloppyDisk, Upload, ArrowCounterClockwise, CheckCircle, CloudArrowDown, Trash, DownloadSimple, Info, Check } from '@phosphor-icons/react'
import { toast } from 'sonner'
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
}

interface SavedTemplate {
  id: string
  name: string
  timestamp: string
  size: number
  data: TemplateData
}

interface TemplateBackupRestoreProps {
  activeTemplates: { cmr?: string; delivery?: string; pallet?: string; 'box-label'?: string }
  setActiveTemplates: (v: { cmr?: string; delivery?: string; pallet?: string; 'box-label'?: string }) => Promise<void>
}

export function TemplateBackupRestore({ activeTemplates, setActiveTemplates }: TemplateBackupRestoreProps) {
  const [templates] = useKV<TemplateData[]>('github-style-templates', [])
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
  
  const [saveName, setSaveName] = useState('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [templateTypeToSave, setTemplateTypeToSave] = useState<'cmr' | 'delivery' | 'pallet' | 'box-label' | null>(null)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [templateToRestore, setTemplateToRestore] = useState<SavedTemplate | null>(null)

  const typeLabel = (type: 'cmr' | 'delivery' | 'pallet' | 'box-label') =>
    type === 'cmr' ? 'CMR' : type === 'pallet' ? 'Raklap cimke' : type === 'box-label' ? 'Etiketta' : 'Szállítólevél'

  const handleSaveTemplate = (type: 'cmr' | 'delivery' | 'pallet' | 'box-label') => {
    const templateToSave = (templates || []).find(t => t.type === type)

    if (!templateToSave) {
      toast.error(`Nincs ${typeLabel(type)} sablon`)
      return
    }

    setTemplateTypeToSave(type)
    setSaveName(`${typeLabel(type)} Sablon - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`)
    setSaveDialogOpen(true)
  }

  const confirmSaveTemplate = () => {
    if (!saveName.trim() || !templateTypeToSave) return

    const templateToSave = (templates || []).find(t => t.type === templateTypeToSave)
    
    if (!templateToSave || !templateToSave.html || templateToSave.html.trim() === '') {
      toast.error('Nincs mentendő sablon vagy üres a sablon tartalma')
      return
    }

    const templateData: TemplateData = {
      id: templateToSave.id,
      name: templateToSave.name,
      type: templateToSave.type,
      html: templateToSave.html,
      css: templateToSave.css,
      timestamp: templateToSave.timestamp,
      description: templateToSave.description
    }

    const newSave: SavedTemplate = {
      id: Date.now().toString(),
      name: saveName.trim(),
      timestamp: new Date().toISOString(),
      size: JSON.stringify(templateData).length,
      data: templateData
    }

    setSavedTemplates((current) => [newSave, ...(current || [])])
    toast.success('Sablon sikeresen mentve')
    setSaveDialogOpen(false)
    setSaveName('')
    setTemplateTypeToSave(null)
  }

  const handleRestoreTemplate = (template: SavedTemplate) => {
    setTemplateToRestore(template)
    setRestoreConfirmOpen(true)
  }

  const confirmRestoreTemplate = () => {
    if (!templateToRestore) return

    const templateData = templateToRestore.data
    
    if (templateData.type === 'cmr') {
      void setActiveTemplates({ ...activeTemplates, cmr: templateToRestore.id })
      toast.success('CMR sablon aktiválva')
    } else if (templateData.type === 'pallet') {
      void setActiveTemplates({ ...activeTemplates, pallet: templateToRestore.id })
      toast.success('Raklap cimke sablon aktiválva')
    } else if (templateData.type === 'box-label') {
      void setActiveTemplates({ ...activeTemplates, 'box-label': templateToRestore.id })
      toast.success('Etiketta sablon aktiválva')
    } else {
      void setActiveTemplates({ ...activeTemplates, delivery: templateToRestore.id })
      toast.success('Szállítólevél sablon aktiválva')
    }

    setRestoreConfirmOpen(false)
    setTemplateToRestore(null)
  }

  const handleDeleteTemplate = (id: string) => {
    setSavedTemplates((current) => (current || []).filter(s => s.id !== id))
    toast.success('Sablon törölve')
  }

  const handleDownloadTemplate = (template: SavedTemplate) => {
    const dataStr = JSON.stringify(template.data, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${template.name}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
    
    toast.success('Sablon exportálva')
  }

  const handleImportTemplate = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const templateData = JSON.parse(event.target?.result as string) as TemplateData
          
          if (!templateData.html || !templateData.type) {
            toast.error('Érvénytelen sablon formátum')
            return
          }

          const newSave: SavedTemplate = {
            id: Date.now().toString(),
            name: templateData.name || `Importált sablon - ${format(new Date(), 'yyyy.MM.dd HH:mm', { locale: hu })}`,
            timestamp: new Date().toISOString(),
            size: JSON.stringify(templateData).length,
            data: templateData
          }

          setSavedTemplates((current) => [newSave, ...(current || [])])
          toast.success('Sablon sikeresen importálva')
        } catch (error) {
          toast.error('Hiba a sablon importálásakor')
          console.error(error)
        }
      }
      reader.readAsText(file)
    }
    
    input.click()
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const cmrTemplate = (templates || []).find(t => t.type === 'cmr')
  const deliveryTemplate = (templates || []).find(t => t.type === 'delivery')
  const palletTemplate = (templates || []).find(t => t.type === 'pallet')
  const boxLabelTemplate = (templates || []).find(t => t.type === 'box-label')

  const cmrTemplateExists = cmrTemplate && cmrTemplate.html && cmrTemplate.html.length > 0
  const deliveryTemplateExists = deliveryTemplate && deliveryTemplate.html && deliveryTemplate.html.length > 0
  const palletTemplateExists = palletTemplate && palletTemplate.html && palletTemplate.html.length > 0
  const boxLabelTemplateExists = boxLabelTemplate && boxLabelTemplate.html && boxLabelTemplate.html.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-1">Sablon Mentések</h2>
        <p className="text-muted-foreground">Sablonok mentése és visszatöltése</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>CMR Sablon</span>
              {activeTemplates?.cmr && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  Aktív
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cmrTemplateExists ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Méret: {formatFileSize(JSON.stringify(cmrTemplate).length)}</p>
                  {cmrTemplate.timestamp && (
                    <p>Utolsó módosítás: {format(new Date(cmrTemplate.timestamp), 'yyyy.MM.dd HH:mm', { locale: hu })}</p>
                  )}
                </div>
                <Button onClick={() => handleSaveTemplate('cmr')} className="w-full">
                  <FloppyDisk className="w-4 h-4 mr-2" />
                  Sablon mentése
                </Button>
              </>
            ) : (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Nincs CMR sablon. Hozz létre egyet a Sablon Szerkesztőben.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Szállítólevél Sablon</span>
              {activeTemplates?.delivery && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  Aktív
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deliveryTemplateExists ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Méret: {formatFileSize(JSON.stringify(deliveryTemplate).length)}</p>
                  {deliveryTemplate.timestamp && (
                    <p>Utolsó módosítás: {format(new Date(deliveryTemplate.timestamp), 'yyyy.MM.dd HH:mm', { locale: hu })}</p>
                  )}
                </div>
                <Button onClick={() => handleSaveTemplate('delivery')} className="w-full">
                  <FloppyDisk className="w-4 h-4 mr-2" />
                  Sablon mentése
                </Button>
              </>
            ) : (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Nincs szállítólevél sablon. Hozz létre egyet a Sablon Szerkesztőben.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Raklap Cimke Sablon</span>
              {activeTemplates?.pallet && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  Aktív
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {palletTemplateExists ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Méret: {formatFileSize(JSON.stringify(palletTemplate).length)}</p>
                  {palletTemplate.timestamp && (
                    <p>Utolsó módosítás: {format(new Date(palletTemplate.timestamp), 'yyyy.MM.dd HH:mm', { locale: hu })}</p>
                  )}
                </div>
                <Button onClick={() => handleSaveTemplate('pallet')} className="w-full">
                  <FloppyDisk className="w-4 h-4 mr-2" />
                  Sablon mentése
                </Button>
              </>
            ) : (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Nincs raklap cimke sablon. Hozz létre egyet a Sablon Szerkesztőben.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Etiketta Sablon</span>
              {activeTemplates?.['box-label'] && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  Aktív
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {boxLabelTemplateExists ? (
              <>
                <div className="text-sm text-muted-foreground">
                  <p>Méret: {formatFileSize(JSON.stringify(boxLabelTemplate).length)}</p>
                  {boxLabelTemplate.timestamp && (
                    <p>Utolsó módosítás: {format(new Date(boxLabelTemplate.timestamp), 'yyyy.MM.dd HH:mm', { locale: hu })}</p>
                  )}
                </div>
                <Button onClick={() => handleSaveTemplate('box-label')} className="w-full">
                  <FloppyDisk className="w-4 h-4 mr-2" />
                  Sablon mentése
                </Button>
              </>
            ) : (
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Nincs etiketta sablon. Hozz létre egyet a Sablon Szerkesztőben.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Mentett Sablonok ({(savedTemplates || []).length})</span>
            <Button onClick={handleImportTemplate} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(savedTemplates || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CloudArrowDown className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nincs mentett sablon</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(savedTemplates || []).map((template) => (
                <Card key={template.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{template.name}</h3>
                          <Badge variant="outline">
                            {typeLabel(template.data.type)}
                          </Badge>
                          {activeTemplates?.[template.data.type] === template.id && (
                            <Badge variant="default" className="gap-1">
                              <Check className="w-3 h-3" />
                              Aktív
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{format(new Date(template.timestamp), 'yyyy. MMMM dd. HH:mm', { locale: hu })}</p>
                          <p>Méret: {formatFileSize(template.size)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {activeTemplates?.[template.data.type] !== template.id && (
                          <Button
                            onClick={() => handleRestoreTemplate(template)}
                            size="sm"
                            variant="default"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Aktiválás
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDownloadTemplate(template)}
                          size="sm"
                          variant="outline"
                        >
                          <DownloadSimple className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => handleDeleteTemplate(template.id)}
                          size="sm"
                          variant="outline"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sablon mentése</DialogTitle>
            <DialogDescription>
              Add meg a mentés nevét
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="save-name">Név</Label>
              <Input
                id="save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Sablon neve..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={confirmSaveTemplate} disabled={!saveName.trim()}>
              <FloppyDisk className="w-4 h-4 mr-2" />
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restoreConfirmOpen} onOpenChange={setRestoreConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sablon aktiválása</DialogTitle>
            <DialogDescription>
              Biztosan aktiválni szeretnéd ezt a sablont?
            </DialogDescription>
          </DialogHeader>
          {templateToRestore && (
            <div className="py-4">
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  <p className="font-semibold mb-1">{templateToRestore.name}</p>
                  <p className="text-sm">
                    Ez a sablon lesz használva a {templateToRestore.data.type === 'cmr' ? 'CMR' : templateToRestore.data.type === 'pallet' ? 'raklap cimke' : 'szállítólevél'} dokumentumok generálásakor.
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmOpen(false)}>
              Mégse
            </Button>
            <Button onClick={confirmRestoreTemplate}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Aktiválás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
