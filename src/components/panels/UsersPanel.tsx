import { SimpleListView, SimpleColumnDef } from '@/components/SimpleListView'
import { Database } from '@phosphor-icons/react'
import { SKINS } from '@/components/SkinSelect'
import type { User } from '@/lib/types'
import type { useAuth } from '@/lib/auth'

/** '' = alap skin; a Radix Select nem enged üres value-t, ezért az 'alap'
 *  sentinel-t használjuk a táblában (a mentéskor '' lesz belőle). */
const SKIN_BASE = 'alap'
const skinName = (id: string) => SKINS.find((s) => s.id === (id || ''))?.name ?? 'Alap'

interface UsersPanelProps {
  users: User[]
  usersLoading: boolean
  auth: ReturnType<typeof useAuth>
  onSave: (u: User & { pin?: string; active?: boolean | string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const ROLE_LABEL_MAP: Record<string, string> = {
  admin: 'Adminisztrátor',
  operator: 'Operátor',
  viewer: 'Megfigyelő',
}

const userColumns: SimpleColumnDef[] = [
  { key: 'name', label: 'Név', required: true, minWidth: 200, placeholder: 'Pl. Kovács János' },
  { key: 'email', label: 'Email', type: 'email', minWidth: 220, placeholder: 'pl. nev@cegnev.hu' },
  {
    key: 'role',
    label: 'Szerepkör',
    type: 'select',
    options: [
      { value: 'admin', label: 'Adminisztrátor' },
      { value: 'operator', label: 'Operátor' },
      { value: 'viewer', label: 'Megfigyelő' },
    ],
    minWidth: 160,
    placeholder: 'Válasszon...',
    formatCell: (v) => ROLE_LABEL_MAP[v] ?? v,
    defaultValue: 'operator',
  },
  {
    key: 'pin',
    label: 'PIN-kód',
    type: 'password',
    digitOnly: true,
    maxLength: 8,
    placeholder: '4–8 számjegy',
    requiredOnCreateOnly: true,
    hideInTable: true,
    helpText:
      'Új felhasználónál kötelező (4–8 számjegy). Szerkesztéskor csak akkor töltsd ki, ha cserélni szeretnéd a PIN-t.',
  },
  {
    key: 'active',
    label: 'Aktív',
    type: 'select',
    options: [
      { value: 'Igen', label: 'Igen' },
      { value: 'Nem', label: 'Nem (zárolt)' },
    ],
    minWidth: 110,
    formatCell: (v) =>
      v === 'true' || v === 'Igen' ? 'Igen' : v === 'false' || v === 'Nem' ? 'Nem' : 'Igen',
    parseValue: (raw) =>
      raw === 'false' || raw === 'Nem' ? 'Nem' : 'Igen',
    defaultValue: 'Igen',
  },
  {
    key: 'skin',
    label: 'Megjelenés',
    type: 'select',
    options: [
      { value: SKIN_BASE, label: 'Alap' },
      ...SKINS.filter((s) => s.id).map((s) => ({ value: s.id, label: s.name })),
    ],
    minWidth: 150,
    // Tárolt '' → 'alap' a szerkesztő-selecthez; a táblában a skin nevét mutatjuk.
    parseValue: (raw) => raw || SKIN_BASE,
    formatCell: (v) => skinName(v),
    defaultValue: SKIN_BASE,
  },
  { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
]

export function UsersPanel({ users, usersLoading, auth, onSave, onDelete }: UsersPanelProps) {
  return (
    <section className="space-y-6">
      <SimpleListView<User>
        title="Felhasználók"
        description={
          auth.user?.role === 'admin'
            ? 'Rendszerfelhasználók és szerepkörök. Új felhasználónál állíts be PIN-t — azzal tud belépni a login képernyőn.'
            : usersLoading
              ? 'Felhasználók betöltése…'
              : 'Csak adminisztrátor tud felhasználókat létrehozni vagy módosítani.'
        }
        icon={<Database className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
        items={users}
        columns={userColumns}
        onSave={onSave}
        onDelete={onDelete}
        addLabel="Új felhasználó"
        addDialogTitle="Új felhasználó hozzáadása"
        editDialogTitle="Felhasználó szerkesztése"
        emptyHint={
          auth.user?.role === 'admin'
            ? 'Vegyen fel új felhasználót az "Új felhasználó" gombbal. PIN-t a felhasználó-űrlapon adhatsz meg.'
            : 'Nincs felhasználó. Adminisztrátor jogosultság szükséges a létrehozáshoz.'
        }
        successMessages={{
          create: 'Felhasználó létrehozva',
          update: 'Felhasználó módosítva',
          delete: 'Felhasználó törölve',
        }}
      />
    </section>
  )
}
