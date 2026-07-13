/**
 * Készlet (Inventory) kezelőpanel — a TIR fő tabjának egyik szigetelt blokkja.
 *
 * Felelőssége:
 *  - listázza az `InventoryItem[]`-eket az `InventoryTable` komponensen át
 *  - kliens oldali kereső (rajzszám / termék név / vevő)
 *  - megnyitja a Készlet- / Készletmódosítás- / Történet- / Raktári bevét
 *    dialógusokat a hívó kódnak átadott setterekkel
 *
 * Architektúra: csak prop-ok — semmi IndexedDB / Dexie / repo közvetlenül.
 * Az audit-naplózást a hívó által átadott `appendAudit` callback végzi,
 * így a szigetelt panelnek nem kell ismernie az audit-rendszert.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, MagnifyingGlass, Warning, ListBullets, SquaresFour } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { InventoryTable } from '@/components/InventoryTable'
import { WarehouseShelfView } from '@/components/WarehouseShelfView'
import { MaterialPanel } from '@/components/MaterialPanel'
import type { MaterialActionKind } from '@/lib/materialService'
import type {
  Order,
  Product,
  InventoryItem,
  InventoryTransaction,
  ProductionShift,
  AuditEntityType,
  AuditAction,
  AuditFieldChange,
} from '@/lib/types'

export interface InventoryPanelProps {
  inventory: InventoryItem[] | null | undefined
  lowStockItems?: InventoryItem[]
  setInventory: (
    updater: (current: InventoryItem[] | null | undefined) => InventoryItem[]
  ) => void
  products: Product[] | null | undefined
  orders: Order[] | null | undefined

  // Az alapanyag-blokkhoz (élő fogyás-becslés + bevét/visszaolvasztás/leltár)
  inventoryTransactions: InventoryTransaction[] | null | undefined
  productionShifts: ProductionShift[] | null | undefined
  onMaterialAction: (result: {
    updatedItem: InventoryItem
    transaction: InventoryTransaction
    kind: MaterialActionKind
  }) => void

  inventorySearchQuery: string
  setInventorySearchQuery: (q: string) => void

  setSelectedInventoryItem: (item: InventoryItem | null) => void
  setInventoryDialogOpen: (open: boolean) => void
  setInventoryAdjustDialogOpen: (open: boolean) => void
  setHistoryInventoryItem: (item: InventoryItem | null) => void
  setInventoryHistoryDialogOpen: (open: boolean) => void
  setWarehouseAddPrefillProductId: (id: string | undefined) => void
  setWarehouseAddDialogOpen: (open: boolean) => void

  /** Hívó által átadott audit-naplózó callback. */
  appendAudit: (
    entityType: AuditEntityType,
    entityLabel: string,
    entityId: string,
    entityName: string,
    action: AuditAction,
    opts?: { changes?: AuditFieldChange[]; notes?: string; userId?: string; userName?: string }
  ) => void
}

export function InventoryPanel({
  inventory,
  setInventory,
  products,
  orders,
  inventoryTransactions,
  productionShifts,
  onMaterialAction,
  lowStockItems = [],
  inventorySearchQuery,
  setInventorySearchQuery,
  setSelectedInventoryItem,
  setInventoryDialogOpen,
  setInventoryAdjustDialogOpen,
  setHistoryInventoryItem,
  setInventoryHistoryDialogOpen,
  setWarehouseAddPrefillProductId,
  setWarehouseAddDialogOpen,
  appendAudit,
}: InventoryPanelProps) {
  const [viewMode, setViewMode] = useState<'list' | 'shelf'>('list')

  /** Helykód mentése a polc-nézetből — auditálva, szinkronizálva. */
  const handleUpdateLocation = (item: InventoryItem, newLocation: string) => {
    const before = item.location
    if (before === newLocation) return
    setInventory((current) =>
      (current || []).map((i) =>
        i.id === item.id ? { ...i, location: newLocation, lastUpdated: new Date().toISOString() } : i
      )
    )
    appendAudit(
      'inventory',
      'Készlet',
      item.id,
      item.productName || item.drawingNumber || item.id,
      'update',
      {
        changes: [{ field: 'location', label: 'Raktár hely', before, after: newLocation }],
        notes: newLocation ? `Elhelyezve: ${newLocation}` : 'Hely törölve',
      }
    )
    toast.success(newLocation ? `Elhelyezve: ${newLocation}` : 'Hely törölve')
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-1">Készlet</h2>
          <p className="text-muted-foreground">Termék készlet nyilvántartás</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border overflow-hidden mr-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode('list')}
            >
              <ListBullets className="w-4 h-4" /> Lista
            </Button>
            <Button
              variant={viewMode === 'shelf' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode('shelf')}
            >
              <SquaresFour className="w-4 h-4" /> Polc nézet
            </Button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setWarehouseAddPrefillProductId(undefined)
              setWarehouseAddDialogOpen(true)
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Raktári bevét
          </Button>
          <Button
            onClick={() => {
              setSelectedInventoryItem(null)
              setInventoryDialogOpen(true)
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Új tétel
          </Button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <Warning className="w-5 h-5 text-destructive mt-0.5 shrink-0" weight="fill" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-destructive text-sm">
              {lowStockItems.length} termék készlete a küszöb alatt van
            </p>
            <ul className="mt-1 space-y-0.5">
              {lowStockItems.slice(0, 5).map(item => (
                <li key={item.id} className="text-sm text-muted-foreground truncate">
                  {item.productName} ({item.drawingNumber}) — {item.quantity} db
                </li>
              ))}
              {lowStockItems.length > 5 && (
                <li className="text-sm text-muted-foreground">
                  … és még {lowStockItems.length - 5} tétel
                </li>
              )}
            </ul>
          </div>
        </div>
      )}

      {viewMode === 'shelf' && (
        <WarehouseShelfView
          inventory={inventory || []}
          onUpdateLocation={handleUpdateLocation}
          onShowHistory={(item) => {
            setHistoryInventoryItem(item)
            setInventoryHistoryDialogOpen(true)
          }}
          onAdjust={(item) => {
            setSelectedInventoryItem(item)
            setInventoryAdjustDialogOpen(true)
          }}
        />
      )}

      {viewMode === 'list' && (
      <div className="relative">
        <MagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Keresés rajzszám, termék név vagy vevő szerint..."
          value={inventorySearchQuery}
          onChange={(e) => setInventorySearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      )}

      {viewMode === 'list' && (
      <InventoryTable
        inventory={(inventory || []).filter((item) => {
          if (!inventorySearchQuery) return true
          const query = inventorySearchQuery.toLowerCase()
          return (
            item.drawingNumber.toLowerCase().includes(query) ||
            item.productName.toLowerCase().includes(query) ||
            item.customer.toLowerCase().includes(query)
          )
        })}
        products={products || []}
        orders={orders || []}
        onEdit={(id) => {
          const item = inventory?.find((i) => i.id === id)
          if (item) {
            setSelectedInventoryItem(item)
            setInventoryDialogOpen(true)
          }
        }}
        onDelete={(id) => {
          const existing = (inventory || []).find((i) => i.id === id)
          setInventory((current) => (current || []).filter((i) => i.id !== id))
          if (existing) {
            appendAudit(
              'inventory',
              'Készlet',
              id,
              existing.productName || existing.drawingNumber || id,
              'delete',
              { notes: `${existing.customer || ''} · ${existing.quantity} db` }
            )
          }
          toast.success('Készlet tétel törölve')
        }}
        onAdjust={(id) => {
          const item = inventory?.find((i) => i.id === id)
          if (item) {
            setSelectedInventoryItem(item)
            setInventoryAdjustDialogOpen(true)
          }
        }}
        onShowHistory={(id) => {
          const item = inventory?.find((i) => i.id === id)
          if (item) {
            setHistoryInventoryItem(item)
            setInventoryHistoryDialogOpen(true)
          }
        }}
        onWarehouseAdd={(productId) => {
          setWarehouseAddPrefillProductId(productId)
          setWarehouseAddDialogOpen(true)
        }}
      />
      )}

      {/* Alapanyag-tároló — külön kijelölt hely, nem a polcrendszeren.
          Élő fogyás-becslés + bevét / visszaolvasztás / leltár. */}
      <MaterialPanel
        title="Alapanyag-tároló"
        inventory={inventory || []}
        shifts={productionShifts || []}
        orders={orders || []}
        products={products || []}
        transactions={inventoryTransactions || []}
        onApply={onMaterialAction}
      />
    </section>
  )
}
