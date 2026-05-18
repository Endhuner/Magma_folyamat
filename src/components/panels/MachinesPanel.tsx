import { useState } from 'react'
import { TabsContent, Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { SimpleListView, SimpleColumnDef } from '@/components/SimpleListView'
import { MachineDetailDialog } from '@/components/MachineDetailDialog'
import { MachinePlanningListView } from '@/components/MachinePlanningListView'
import { Factory, Camera, Wrench } from '@phosphor-icons/react'
import type { Machine, Order } from '@/lib/types'
import type { useAuth } from '@/lib/auth'

interface MachinesPanelProps {
  machines: Machine[]
  orders: Order[] | undefined
  auth: ReturnType<typeof useAuth>
  onSave: (m: Machine) => void
  onDelete: (id: string) => void
}

const machineColumns: SimpleColumnDef[] = [
  { key: 'name', label: 'Név', required: true, minWidth: 200, placeholder: 'Pl. Engel Victory 120' },
  { key: 'serialNumber', label: 'Gyári szám', minWidth: 160, placeholder: 'Pl. SN-123456' },
  { key: 'type', label: 'Típus', minWidth: 160, placeholder: 'Pl. fröccsöntő' },
  { key: 'capacity', label: 'Befogókapacitás', minWidth: 160, placeholder: 'Pl. 120 t' },
  { key: 'notes', label: 'Megjegyzés', type: 'textarea', minWidth: 240, truncate: true },
]

export function MachinesPanel({ machines, orders, auth, onSave, onDelete }: MachinesPanelProps) {
  const [detailMachineId, setDetailMachineId] = useState<string | null>(null)
  const [detailMachineTab, setDetailMachineTab] = useState<'photo' | 'oils' | 'accessories' | 'repairs'>('photo')

  return (
    <TabsContent value="machines">
      <Tabs defaultValue="machine-list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="machine-list">Gépek listája</TabsTrigger>
          <TabsTrigger value="machine-planning-list">Tervezett munkák</TabsTrigger>
        </TabsList>

        <TabsContent value="machine-list" className="space-y-6">
          <SimpleListView<Machine>
            title="Gépek"
            description="Termelőgépek és berendezések adatai"
            icon={<Factory className="w-16 h-16 text-muted-foreground mb-4" weight="duotone" />}
            items={machines}
            columns={machineColumns}
            onSave={onSave}
            onDelete={onDelete}
            addLabel="Új gép"
            addDialogTitle="Új gép hozzáadása"
            editDialogTitle="Gép szerkesztése"
            emptyHint='Vegyen fel új gépet az "Új gép" gombbal.'
            canDelete={(m) =>
              auth.user?.role === 'admin' ||
              !m.createdBy ||
              m.createdBy === auth.user?.id
            }
            extraActions={(machine) => (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Fotó feltöltése"
                  onClick={() => { setDetailMachineTab('photo'); setDetailMachineId(machine.id) }}
                >
                  <Camera className="w-4 h-4 text-accent" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Olajok / Kiegészítések / Javítások"
                  onClick={() => { setDetailMachineTab('oils'); setDetailMachineId(machine.id) }}
                >
                  <Wrench className="w-4 h-4 text-accent" />
                </Button>
              </>
            )}
          />
          <MachineDetailDialog
            open={detailMachineId !== null}
            onClose={() => setDetailMachineId(null)}
            machine={machines.find((m) => m.id === detailMachineId) ?? null}
            initialTab={detailMachineTab}
            onSave={onSave}
          />
        </TabsContent>

        <TabsContent value="machine-planning-list">
          <MachinePlanningListView
            machines={machines}
            orders={orders || []}
          />
        </TabsContent>
      </Tabs>
    </TabsContent>
  )
}
