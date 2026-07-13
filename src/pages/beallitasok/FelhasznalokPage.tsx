import { UsersPanel } from '@/components/panels/UsersPanel'
import { useAppShell } from '@/components/layout/AppShellContext'

export default function FelhasznalokPage() {
  const s = useAppShell()
  return (
    <UsersPanel
      users={s.users}
      usersLoading={s.usersLoading}
      auth={s.auth}
      onSave={s.handleSaveUser}
      onDelete={s.handleDeleteUser}
    />
  )
}
