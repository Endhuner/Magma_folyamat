import { ToolsPanel } from '@/components/panels/ToolsPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function EszkozlistaPage() {
  const s = useAppShell()
  return (
    <ToolsPanel
      tools={s.tools}
      onSave={s.handleSaveTool}
      onDelete={s.handleDeleteTool}
      // a backend törlést csak adminnak enged — ne kínáljunk gombot operátornak
      canDelete={s.auth.user?.role === 'admin'}
    />
  )
}
