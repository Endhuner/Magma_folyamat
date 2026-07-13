import { MachinesPanel } from '@/components/panels/MachinesPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function GepekPage() {
  const s = useAppShell()
  return (
    <MachinesPanel
      machines={s.machines}
      orders={s.orders}
      auth={s.auth}
      onSave={s.handleSaveMachine}
      onDelete={s.handleDeleteMachine}
    />
  )
}
