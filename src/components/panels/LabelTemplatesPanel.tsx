/**
 * Címke-sablonok kezelőpanel — a TIR fő tabjának egyik szigetelt blokkja.
 *
 * Felelőssége:
 *  - listázza a localStorage-ben tárolt `LabelTemplate[]`-et
 *  - kezeli az aktiválás / másolás / exportálás / importálás / törlés
 *    műveleteket
 *  - előnézetet generál maximum 3 demo-rendelésre
 *
 * Architektúra: a komponens csak prop-okon keresztül kap adatot, nem érint
 * IndexedDB-t. Ezzel az App.tsx fő fájl ~205 sorral karcsúbb lett, és a
 * címke-funkció külön tesztelhető / cserélhető.
 */
import { useRef, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@/components/ui/tabs'
import { Plus, Upload, Download, FileText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  exportLabelTemplate,
  exportMultipleLabelTemplates,
  previewLabels,
  type LabelTemplate,
} from '@/lib/labelTemplate'
import type { Order, Customer, Product } from '@/lib/types'

export interface LabelTemplatesPanelProps {
  labelTemplates: LabelTemplate[] | null | undefined
  setLabelTemplates: (
    updater: (current: LabelTemplate[] | null | undefined) => LabelTemplate[]
  ) => void
  activeLabelTemplateId: string | null | undefined
  setActiveLabelTemplateId: (id: string | null) => void
  /** Az "Új sablon" gombbal megnyitott dialógus külső állapota. */
  setSelectedLabelTemplate: (t: LabelTemplate | null) => void
  setLabelTemplateDialogOpen: (open: boolean) => void
  /** Az előnézet előállításához használt rendelések — max 3 darabot mintázunk. */
  orders: Order[] | null | undefined
  customers: Customer[] | null | undefined
  products: Product[] | null | undefined
  /** Opcionális — ha az App.tsx már birtokol egy import-input ref-et,
   * azt adhatjuk át, hogy a fókusz külső kezelése konzisztens legyen. */
  importInputRef?: RefObject<HTMLInputElement | null>
}

export function LabelTemplatesPanel({
  labelTemplates,
  setLabelTemplates,
  activeLabelTemplateId,
  setActiveLabelTemplateId,
  setSelectedLabelTemplate,
  setLabelTemplateDialogOpen,
  orders,
  customers,
  products,
  importInputRef,
}: LabelTemplatesPanelProps) {
  // Ha a hívó nem adott át ref-et, sajátot tartunk fenn (ne legyen fél-state).
  const internalImportRef = useRef<HTMLInputElement | null>(null)
  const labelImportInputRef = importInputRef ?? internalImportRef

  return (
    <TabsContent value="label-templates" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Címke Sablonok</h2>
          <p className="text-muted-foreground">Címke sablonok kezelése és testreszabása</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={labelImportInputRef}
            type="file"
            accept=".json"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const { importMultipleLabelTemplates } = await import('@/lib/labelTemplate')
                const imported = await importMultipleLabelTemplates(file)
                setLabelTemplates((current) => [...(current || []), ...imported])
                toast.success(`${imported.length} címke sablon importálva`)
              } catch (error) {
                console.error('Import error:', error)
                toast.error('Hiba az importálás során')
              }
              if (labelImportInputRef.current) {
                labelImportInputRef.current.value = ''
              }
            }}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => labelImportInputRef.current?.click()}>
            <Upload className="w-5 h-5 mr-2" />
            Importálás
          </Button>
          {(labelTemplates || []).length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                exportMultipleLabelTemplates(labelTemplates || [])
              }}
            >
              <Download className="w-5 h-5 mr-2" />
              Összes Exportálása
            </Button>
          )}
          <Button
            onClick={() => {
              setSelectedLabelTemplate(null)
              setLabelTemplateDialogOpen(true)
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Új Sablon
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(labelTemplates || []).map((template) => (
          <div
            key={template.id}
            className={`border rounded-lg p-4 space-y-3 cursor-pointer transition-all ${
              activeLabelTemplateId === template.id
                ? 'border-primary bg-primary/5'
                : 'hover:border-primary/50'
            }`}
            onClick={() => setActiveLabelTemplateId(template.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {template.description}
                  </p>
                )}
              </div>
              {activeLabelTemplateId === template.id && (
                <Badge variant="default" className="ml-2">
                  Aktív
                </Badge>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>{template.labelsPerPage || 40} címke / oldal</p>
              <p>
                {template.labelsPerRow || 5} × {template.labelsPerColumn || 8} elrendezés
              </p>
              <p className="font-mono">
                Margók: {template.margins.top}/{template.margins.right}/
                {template.margins.bottom}/{template.margins.left} mm
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedLabelTemplate(template)
                  setLabelTemplateDialogOpen(true)
                }}
              >
                Szerkesztés
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async (e) => {
                  e.stopPropagation()
                  const demoOrders = orders?.slice(0, 3) || []
                  if (demoOrders.length === 0) {
                    toast.info('Nincs rendelés az előnézethez')
                    return
                  }
                  const html = await previewLabels(
                    demoOrders,
                    customers || [],
                    products || [],
                    template
                  )
                  const win = window.open('', '_blank')
                  if (win) {
                    win.document.write(html)
                    win.document.close()
                  }
                }}
              >
                Előnézet
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  const copiedTemplate: LabelTemplate = {
                    ...template,
                    id: `label-template-${Date.now()}`,
                    name: `${template.name} (másolat)`,
                    timestamp: new Date().toISOString(),
                  }
                  setLabelTemplates((current) => [...(current || []), copiedTemplate])
                  toast.success('Sablon másolva')
                }}
              >
                Másolás
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveLabelTemplateId(template.id)
                  toast.success(`${template.name} beállítva aktívként`)
                }}
              >
                Aktiválás
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  exportLabelTemplate(template)
                }}
              >
                Exportálás
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  if (activeLabelTemplateId === template.id) {
                    setActiveLabelTemplateId(null)
                  }
                  setLabelTemplates((current) =>
                    (current || []).filter((t) => t.id !== template.id)
                  )
                  toast.success('Sablon törölve')
                }}
              >
                Törlés
              </Button>
            </div>
          </div>
        ))}

        {(labelTemplates || []).length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />
            <h3 className="text-xl font-semibold mb-2">Nincs címke sablon</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Hozz létre egyedi címke sablonokat a termékek címkézéséhez
            </p>
            <Button onClick={() => setLabelTemplateDialogOpen(true)}>
              <Plus className="w-5 h-5 mr-2" />
              Első Sablon Létrehozása
            </Button>
          </div>
        )}
      </div>

      {activeLabelTemplateId && (
        <div className="border rounded-lg p-4 bg-accent/10">
          <p className="text-sm font-medium">
            Aktív sablon:{' '}
            <span className="font-bold">
              {labelTemplates?.find((t) => t.id === activeLabelTemplateId)?.name ||
                'Alapértelmezett'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Ez a sablon lesz használva a címkék generálásakor a rendelésekben
          </p>
        </div>
      )}
    </TabsContent>
  )
}
