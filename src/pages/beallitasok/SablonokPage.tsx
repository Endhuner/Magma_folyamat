import { Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GithubStyleTemplateEditor, TemplateBackupRestore } from '@/components/lazy'
import { LabelTemplatesPanel } from '@/components/panels/LabelTemplatesPanel'
import { useAppShell } from '@/components/layout/AppShellContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * Sablonok — a korábbi három külön fül (Sablon szerkesztő, Sablon mentések,
 * Címke sablonok) egy oldalon, belső fülekkel. Az aktív fül a ?tab=
 * URL-paraméterben él, így mindhárom nézet linkelhető.
 */
export default function SablonokPage() {
  const s = useAppShell()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'szerkeszto'
  return (
    <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} className="space-y-6">
      <TabsList>
        <TabsTrigger value="szerkeszto">Sablon szerkesztő</TabsTrigger>
        <TabsTrigger value="mentesek">Sablon mentések</TabsTrigger>
        <TabsTrigger value="cimkek">Címke sablonok</TabsTrigger>
      </TabsList>
      <TabsContent value="szerkeszto">
        <Suspense fallback={<div className="text-muted-foreground p-4">Sablonszerkesztő betöltése…</div>}>
          <GithubStyleTemplateEditor />
        </Suspense>
      </TabsContent>
      <TabsContent value="mentesek">
        <Suspense fallback={<div className="text-muted-foreground p-4">Sablonkezelő betöltése…</div>}>
          <TemplateBackupRestore
            activeTemplates={s.activeTemplates || {}}
            setActiveTemplates={s.setActiveTemplates}
          />
        </Suspense>
      </TabsContent>
      <TabsContent value="cimkek">
        <LabelTemplatesPanel
          labelTemplates={s.labelTemplates}
          setLabelTemplates={s.setLabelTemplates}
          activeLabelTemplateId={s.activeLabelTemplateId}
          setActiveLabelTemplateId={s.setActiveLabelTemplateId}
          setSelectedLabelTemplate={s.setSelectedLabelTemplate}
          setLabelTemplateDialogOpen={s.setLabelTemplateDialogOpen}
          orders={s.orders}
          customers={s.customers}
          products={s.products}
          importInputRef={s.importInputRef}
        />
      </TabsContent>
    </Tabs>
  )
}
