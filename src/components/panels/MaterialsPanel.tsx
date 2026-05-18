import { TabsContent } from '@/components/ui/tabs'
import { SimpleListView, SimpleColumnDef } from '@/components/SimpleListView'
import { Package } from '@phosphor-icons/react'
import type { Material } from '@/lib/types'
import type { useAuth } from '@/lib/auth'

interface MaterialsPanelProps {
  materials: Material[]
  auth: ReturnType<typeof useAuth>
  onSave: (m: Material) => void
  onDelete: (id: string) => void
}

const materialColumns: SimpleColumnDef[] = [
  { key: 'name', label: 'Anyag neve', required: true, minWidth: 200, placeholder: 'Pl. PA66 GF30' },
  { key: 'type', label: 'Típus', minWidth: 160, placeholder: 'Pl. granulátum' },
  { key: 'supplier', label: 'Beszállító', minWidth: 200, placeholder: 'Pl. BASF' },
  { key: 'unitPrice', label: 'Egységár', type: 'number', minWidth: 140, placeholder: 'Pl. 1250' },
  {
    key: 'unit',
    label: 'Egység',
    type: 'select',
    options: ['kg', 'g', 'db', 'l', 'm'],
    minWidth: 120,
  },
  { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
]

export function MaterialsPanel({ materials, auth, onSave, onDelete }: MaterialsPanelProps) {
  return (
    <TabsContent value="materials" className="space-y-6">
      <SimpleListView<Material>
        title="Anyaglista"
        description="Alapanyagok és granulátumok nyilvántartása"
        icon={<Package className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
        items={materials}
        columns={materialColumns}
        onSave={onSave}
        onDelete={onDelete}
        addLabel="Új anyag"
        addDialogTitle="Új anyag hozzáadása"
        editDialogTitle="Anyag szerkesztése"
        emptyHint='Vegyen fel új anyagot az "Új anyag" gombbal.'
        canDelete={(m) =>
          auth.user?.role === 'admin' ||
          !m.createdBy ||
          m.createdBy === auth.user?.id
        }
      />
    </TabsContent>
  )
}
