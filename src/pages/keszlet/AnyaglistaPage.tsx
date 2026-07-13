import { MaterialsPanel } from '@/components/panels/MaterialsPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function AnyaglistaPage() {
  const s = useAppShell()
  return (
    <MaterialsPanel
      materials={s.materials}
      auth={s.auth}
      onSave={s.handleSaveMaterial}
      onDelete={s.handleDeleteMaterial}
    />
  )
}
