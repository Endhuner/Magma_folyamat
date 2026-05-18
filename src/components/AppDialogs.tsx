import { Suspense } from 'react'
import { toast } from 'sonner'
import { generateId } from '@/lib/generateId'
import { diffObjects } from '@/lib/auditLog'
import { previewLabels, generateLabelsWithPrintSettings, LabelTemplate } from '@/lib/labelTemplate'
import { InventoryDialog } from '@/components/InventoryDialog'
import { InventoryAdjustDialog } from '@/components/InventoryAdjustDialog'
import { InventoryDeductionDialog } from '@/components/InventoryDeductionDialog'
import { InventoryHistoryDialog } from '@/components/InventoryHistoryDialog'
import { WarehouseAddDialog } from '@/components/WarehouseAddDialog'
import { OrderDialog } from '@/components/OrderDialog'
import { OrderBulkImportDialog } from '@/components/OrderBulkImportDialog'
import { CustomerDialog } from '@/components/CustomerDialog'
import { BulkImportDialog } from '@/components/BulkImportDialog'
import { ProductDialog } from '@/components/ProductDialog'
import { ProductBulkImportDialog } from '@/components/ProductBulkImportDialog'
import { ValidationDialog } from '@/components/ValidationDialog'
import { DocumentFilterDialog } from '@/components/DocumentFilterDialog'
import { OrderColumnFilterDialog } from '@/components/OrderColumnFilterDialog'
import { LabelPrintSettingsDialog } from '@/components/LabelPrintSettingsDialog'
import {
  CmrSettingsDialog,
  DeliverySettingsDialog,
  LabelTemplateDialog,
} from '@/components/lazy'
import type {
  Order,
  OrderStatus,
  Customer,
  Product,
  InventoryItem,
  InventoryTransaction,
} from '@/lib/types'
import type { ValidationResult } from '@/lib/exportValidation'
import type { InventoryDeductionResult } from '@/lib/inventoryService'
import type { AuditEntityType, AuditAction, AuditFieldChange } from '@/lib/types'

interface SavedTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  timestamp: string
}

type AppendAudit = (
  entityType: AuditEntityType,
  entityLabel: string,
  entityId: string,
  entityName: string,
  action: AuditAction,
  opts?: { changes?: AuditFieldChange[]; notes?: string; userId?: string; userName?: string }
) => void

interface AppDialogsProps {
  // Inventory dialogs
  inventoryDialogOpen: boolean
  setInventoryDialogOpen: (v: boolean) => void
  selectedInventoryItem: InventoryItem | null
  setSelectedInventoryItem: (v: InventoryItem | null) => void
  inventory: InventoryItem[] | undefined
  setInventory: (updater: InventoryItem[] | ((prev: InventoryItem[] | undefined) => InventoryItem[])) => void
  products: Product[] | undefined
  appendAudit: AppendAudit

  inventoryAdjustDialogOpen: boolean
  setInventoryAdjustDialogOpen: (v: boolean) => void
  inventoryTransactions: InventoryTransaction[] | undefined
  setInventoryTransactions: (updater: InventoryTransaction[] | ((prev: InventoryTransaction[] | undefined) => InventoryTransaction[])) => void

  inventoryDeductionDialogOpen: boolean
  setInventoryDeductionDialogOpen: (v: boolean) => void
  pendingDeductionResult: InventoryDeductionResult | null
  setPendingDeductionResult: (v: InventoryDeductionResult | null) => void
  pendingStatusChange: { orderIds: string[]; status: OrderStatus } | null
  setPendingStatusChange: (v: { orderIds: string[]; status: OrderStatus } | null) => void
  setPendingPostDeduction: (v: (() => void | Promise<void>) | null) => void
  deductionContext: string
  setDeductionContext: (v: string) => void
  handleConfirmInventoryDeduction: () => Promise<void>

  inventoryHistoryDialogOpen: boolean
  setInventoryHistoryDialogOpen: (v: boolean) => void
  historyInventoryItem: InventoryItem | null
  setHistoryInventoryItem: (v: InventoryItem | null) => void
  orders: Order[] | undefined

  warehouseAddDialogOpen: boolean
  setWarehouseAddDialogOpen: (v: boolean) => void
  warehouseAddPrefillProductId: string | undefined
  setWarehouseAddPrefillProductId: (v: string | undefined) => void

  // Order dialogs
  orderDialogOpen: boolean
  setOrderDialogOpen: (v: boolean) => void
  selectedOrder: Order | null
  setSelectedOrder: (v: Order | null) => void
  handleSaveOrder: (data: Partial<Order>) => void
  customers: Customer[] | undefined

  orderBulkImportDialogOpen: boolean
  setOrderBulkImportDialogOpen: (v: boolean) => void
  handleOrderBulkImport: (items: Partial<Order>[]) => void

  // Validation dialog
  validationDialogOpen: boolean
  setValidationDialogOpen: (v: boolean) => void
  validationResult: ValidationResult | null
  setValidationResult: (v: ValidationResult | null) => void
  pendingExportType: 'cmr' | 'delivery' | null
  setPendingExportType: (v: 'cmr' | 'delivery' | null) => void
  handleValidationContinue: () => Promise<void>
  selectedOrderIds: string[]
  handleEditOrder: (id: string) => void
  cmrSettingsDialogOpen: boolean
  setCmrSettingsDialogOpen: (v: boolean) => void
  deliverySettingsDialogOpen: boolean
  setDeliverySettingsDialogOpen: (v: boolean) => void

  // Customer dialogs
  customerDialogOpen: boolean
  setCustomerDialogOpen: (v: boolean) => void
  selectedCustomer: Customer | null
  setSelectedCustomer: (v: Customer | null) => void
  handleSaveCustomer: (data: Partial<Customer>) => void
  savedTemplates: Array<{ data?: SavedTemplate }> | undefined
  labelTemplates: LabelTemplate[] | undefined

  bulkImportDialogOpen: boolean
  setBulkImportDialogOpen: (v: boolean) => void
  handleBulkImport: (items: Partial<Customer>[]) => void

  // Product dialogs
  productDialogOpen: boolean
  setProductDialogOpen: (v: boolean) => void
  selectedProduct: Product | null
  setSelectedProduct: (v: Product | null) => void
  handleSaveProduct: (data: Partial<Product>) => void

  productBulkImportDialogOpen: boolean
  setProductBulkImportDialogOpen: (v: boolean) => void
  handleProductBulkImport: (items: Partial<Product>[]) => void

  // Document filter dialogs
  newFilterDialogOpen: boolean
  setNewFilterDialogOpen: (v: boolean) => void
  setDocumentFilters: (updater: Array<{ id: string; name: string; columns: string[] }> | ((prev: Array<{ id: string; name: string; columns: string[] }> | undefined) => Array<{ id: string; name: string; columns: string[] }>)) => void

  newOrderFilterDialogOpen: boolean
  setNewOrderFilterDialogOpen: (v: boolean) => void
  setOrderColumnFilters: (updater: Array<{ id: string; name: string; columns: string[] }> | ((prev: Array<{ id: string; name: string; columns: string[] }> | undefined) => Array<{ id: string; name: string; columns: string[] }>)) => void
  setActiveOrderFilterId: (v: string | null) => void

  // Label template dialog
  labelTemplateDialogOpen: boolean
  setLabelTemplateDialogOpen: (v: boolean) => void
  selectedLabelTemplate: LabelTemplate | null
  setSelectedLabelTemplate: (v: LabelTemplate | null) => void
  labelTemplatesApiAdd: (t: LabelTemplate) => void
  labelTemplatesApiReplace: (t: LabelTemplate) => void
  activeLabelTemplateId: string | null

  // Label print settings dialog
  labelPrintSettingsDialogOpen: boolean
  setLabelPrintSettingsDialogOpen: (v: boolean) => void
}

export function AppDialogs({
  inventoryDialogOpen, setInventoryDialogOpen,
  selectedInventoryItem, setSelectedInventoryItem,
  inventory, setInventory, products, appendAudit,
  inventoryAdjustDialogOpen, setInventoryAdjustDialogOpen,
  inventoryTransactions, setInventoryTransactions,
  inventoryDeductionDialogOpen, setInventoryDeductionDialogOpen,
  pendingDeductionResult, setPendingDeductionResult,
  pendingStatusChange, setPendingStatusChange,
  setPendingPostDeduction, deductionContext, setDeductionContext,
  handleConfirmInventoryDeduction,
  inventoryHistoryDialogOpen, setInventoryHistoryDialogOpen,
  historyInventoryItem, setHistoryInventoryItem, orders,
  warehouseAddDialogOpen, setWarehouseAddDialogOpen,
  warehouseAddPrefillProductId, setWarehouseAddPrefillProductId,
  orderDialogOpen, setOrderDialogOpen,
  selectedOrder, setSelectedOrder, handleSaveOrder, customers,
  orderBulkImportDialogOpen, setOrderBulkImportDialogOpen, handleOrderBulkImport,
  validationDialogOpen, setValidationDialogOpen,
  validationResult, setValidationResult,
  pendingExportType, setPendingExportType,
  handleValidationContinue, selectedOrderIds, handleEditOrder,
  cmrSettingsDialogOpen, setCmrSettingsDialogOpen,
  deliverySettingsDialogOpen, setDeliverySettingsDialogOpen,
  customerDialogOpen, setCustomerDialogOpen,
  selectedCustomer, setSelectedCustomer, handleSaveCustomer,
  savedTemplates, labelTemplates,
  bulkImportDialogOpen, setBulkImportDialogOpen, handleBulkImport,
  productDialogOpen, setProductDialogOpen,
  selectedProduct, setSelectedProduct, handleSaveProduct,
  productBulkImportDialogOpen, setProductBulkImportDialogOpen, handleProductBulkImport,
  newFilterDialogOpen, setNewFilterDialogOpen, setDocumentFilters,
  newOrderFilterDialogOpen, setNewOrderFilterDialogOpen,
  setOrderColumnFilters, setActiveOrderFilterId,
  labelTemplateDialogOpen, setLabelTemplateDialogOpen,
  selectedLabelTemplate, setSelectedLabelTemplate,
  labelTemplatesApiAdd, labelTemplatesApiReplace, activeLabelTemplateId,
  labelPrintSettingsDialogOpen, setLabelPrintSettingsDialogOpen,
}: AppDialogsProps) {
  return (
    <>
      <InventoryDialog
        open={inventoryDialogOpen}
        onClose={() => {
          setInventoryDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(itemData) => {
          if (selectedInventoryItem) {
            const before = inventory?.find((i) => i.id === selectedInventoryItem.id)
            const after = before ? { ...before, ...itemData } : null
            setInventory((current) =>
              (current || []).map((item) =>
                item.id === selectedInventoryItem.id ? { ...item, ...itemData } : item
              )
            )
            if (before && after) {
              const changes = diffObjects(
                before as unknown as Record<string, unknown>,
                after as unknown as Record<string, unknown>,
                ['updatedAt', 'lastUpdated']
              )
              if (changes.length > 0) {
                appendAudit(
                  'inventory', 'Készlet', selectedInventoryItem.id,
                  before.productName || before.drawingNumber || selectedInventoryItem.id,
                  'update', { changes, notes: before.customer }
                )
              }
            }
            toast.success('Készlet tétel frissítve')
          } else {
            const newItem: InventoryItem = {
              id: generateId(),
              ...itemData,
              createdAt: new Date().toISOString(),
            } as InventoryItem
            setInventory((current) => [...(current || []), newItem])
            appendAudit(
              'inventory', 'Készlet', newItem.id,
              newItem.productName || newItem.drawingNumber || newItem.id,
              'create', { notes: `${newItem.customer || ''} · ${newItem.quantity} db` }
            )
            toast.success('Készlet tétel létrehozva')
          }
        }}
        item={selectedInventoryItem}
        products={products || []}
      />

      <InventoryAdjustDialog
        open={inventoryAdjustDialogOpen}
        onClose={() => {
          setInventoryAdjustDialogOpen(false)
          setSelectedInventoryItem(null)
        }}
        onSave={(adjustment) => {
          if (!selectedInventoryItem) return

          const transaction: InventoryTransaction = {
            id: generateId(),
            inventoryItemId: selectedInventoryItem.id,
            type: adjustment.type,
            quantity: adjustment.quantity,
            notes: adjustment.notes,
            createdAt: new Date().toISOString(),
          }

          setInventoryTransactions((current) => [...(current || []), transaction])

          let beforeQty = selectedInventoryItem.quantity
          let afterQty = beforeQty
          setInventory((current) =>
            (current || []).map((item) => {
              if (item.id !== selectedInventoryItem.id) return item

              let newQuantity = item.quantity
              if (adjustment.type === 'in') {
                newQuantity += adjustment.quantity
              } else if (adjustment.type === 'out') {
                newQuantity = Math.max(0, newQuantity - adjustment.quantity)
              } else if (adjustment.type === 'adjustment') {
                newQuantity = adjustment.quantity
              }
              afterQty = newQuantity
              beforeQty = item.quantity

              return { ...item, quantity: newQuantity, lastUpdated: new Date().toISOString() }
            })
          )

          appendAudit(
            'inventory', 'Készlet', selectedInventoryItem.id,
            selectedInventoryItem.productName || selectedInventoryItem.drawingNumber || selectedInventoryItem.id,
            adjustment.type,
            {
              changes: [{ field: 'quantity', label: 'Mennyiség (db)', before: beforeQty, after: afterQty }],
              notes: adjustment.notes || `${adjustment.quantity} db`,
            }
          )

          toast.success('Készlet módosítva')
        }}
        item={selectedInventoryItem}
      />

      <OrderDialog
        open={orderDialogOpen}
        onClose={() => { setOrderDialogOpen(false); setSelectedOrder(null) }}
        onSave={handleSaveOrder}
        order={selectedOrder}
        customers={customers || []}
        products={products || []}
        orders={orders || []}
      />

      <OrderBulkImportDialog
        open={orderBulkImportDialogOpen}
        onClose={() => setOrderBulkImportDialogOpen(false)}
        onImport={handleOrderBulkImport}
      />

      <CustomerDialog
        open={customerDialogOpen}
        onClose={() => { setCustomerDialogOpen(false); setSelectedCustomer(null) }}
        onSave={handleSaveCustomer}
        customer={selectedCustomer}
        savedTemplates={savedTemplates?.map(t => t.data).filter((d): d is SavedTemplate => Boolean(d)) || []}
        labelTemplates={labelTemplates || []}
      />

      <BulkImportDialog
        open={bulkImportDialogOpen}
        onClose={() => setBulkImportDialogOpen(false)}
        onImport={handleBulkImport}
      />

      <ProductDialog
        open={productDialogOpen}
        onClose={() => { setProductDialogOpen(false); setSelectedProduct(null) }}
        onSave={handleSaveProduct}
        product={selectedProduct}
      />

      <ProductBulkImportDialog
        open={productBulkImportDialogOpen}
        onClose={() => setProductBulkImportDialogOpen(false)}
        onImport={handleProductBulkImport}
      />

      {cmrSettingsDialogOpen && (
        <Suspense fallback={null}>
          <CmrSettingsDialog
            open={cmrSettingsDialogOpen}
            onClose={() => setCmrSettingsDialogOpen(false)}
          />
        </Suspense>
      )}

      {deliverySettingsDialogOpen && (
        <Suspense fallback={null}>
          <DeliverySettingsDialog
            open={deliverySettingsDialogOpen}
            onClose={() => setDeliverySettingsDialogOpen(false)}
          />
        </Suspense>
      )}

      <ValidationDialog
        open={validationDialogOpen}
        onClose={() => {
          setValidationDialogOpen(false)
          setPendingExportType(null)
          setValidationResult(null)
        }}
        onContinue={handleValidationContinue}
        validation={validationResult || { isValid: true, errors: [], warnings: [] }}
        title={pendingExportType === 'cmr' ? 'CMR Export Ellenőrzés' : 'Szállítólevél Export Ellenőrzés'}
        orders={(orders || []).filter(o => selectedOrderIds.includes(o.id))}
        onEditOrder={handleEditOrder}
        onEditSettings={() => {
          if (pendingExportType === 'cmr') setCmrSettingsDialogOpen(true)
          else if (pendingExportType === 'delivery') setDeliverySettingsDialogOpen(true)
        }}
        exportType={pendingExportType || undefined}
      />

      <DocumentFilterDialog
        open={newFilterDialogOpen}
        onClose={() => setNewFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = { id: Date.now().toString(), ...filter }
          setDocumentFilters((current) => [...(current || []), newFilter])
          toast.success(`Szűrő "${filter.name}" létrehozva`)
        }}
      />

      <OrderColumnFilterDialog
        open={newOrderFilterDialogOpen}
        onClose={() => setNewOrderFilterDialogOpen(false)}
        onSave={(filter) => {
          const newFilter = { id: Date.now().toString(), ...filter }
          setOrderColumnFilters((current) => [...(current || []), newFilter])
          setActiveOrderFilterId(newFilter.id)
          toast.success(`Oszlop szűrő "${filter.name}" létrehozva és aktiválva`)
        }}
      />

      {labelTemplateDialogOpen && (
        <Suspense fallback={null}>
          <LabelTemplateDialog
            open={labelTemplateDialogOpen}
            onClose={() => {
              setLabelTemplateDialogOpen(false)
              setSelectedLabelTemplate(null)
            }}
            onSave={(template) => {
              if (selectedLabelTemplate) {
                labelTemplatesApiReplace(template)
                toast.success('Sablon frissítve')
              } else {
                labelTemplatesApiAdd(template)
                toast.success('Sablon létrehozva')
              }
              setLabelTemplateDialogOpen(false)
              setSelectedLabelTemplate(null)
            }}
            template={selectedLabelTemplate || undefined}
            onPreview={async (template) => {
              const base = selectedOrderIds.length === 0
                ? (orders?.slice(0, 3) || [])
                : (orders || []).filter(o => selectedOrderIds.includes(o.id))
              if (base.length === 0) {
                toast.info('Nincs rendelés az előnézethez')
                return
              }
              const html = await previewLabels(base, customers || [], products || [], template, labelTemplates)
              const win = window.open('', '_blank')
              if (win) { win.document.write(html); win.document.close() }
            }}
          />
        </Suspense>
      )}

      <InventoryDeductionDialog
        open={inventoryDeductionDialogOpen}
        onClose={() => {
          setInventoryDeductionDialogOpen(false)
          setPendingDeductionResult(null)
          setPendingStatusChange(null)
          setPendingPostDeduction(null)
          setDeductionContext('státuszváltás')
        }}
        onConfirm={handleConfirmInventoryDeduction}
        deductionResult={pendingDeductionResult}
        context={deductionContext}
      />

      <InventoryHistoryDialog
        open={inventoryHistoryDialogOpen}
        onClose={() => {
          setInventoryHistoryDialogOpen(false)
          setHistoryInventoryItem(null)
        }}
        item={historyInventoryItem}
        transactions={inventoryTransactions || []}
        orders={orders || []}
      />

      <WarehouseAddDialog
        open={warehouseAddDialogOpen}
        onClose={() => {
          setWarehouseAddDialogOpen(false)
          setWarehouseAddPrefillProductId(undefined)
        }}
        products={products || []}
        inventory={inventory || []}
        prefillProductId={warehouseAddPrefillProductId}
        onSubmit={({ item, transaction, createdNew }) => {
          if (createdNew) {
            setInventory((current) => [...(current || []), item])
            appendAudit(
              'inventory', 'Készlet', item.id,
              item.productName || item.drawingNumber || item.id,
              'create', { notes: `${item.customer || ''} · ${item.quantity} db` }
            )
          } else {
            const before = (inventory || []).find((i) => i.id === item.id)
            setInventory((current) => (current || []).map((i) => (i.id === item.id ? item : i)))
            if (before) {
              appendAudit(
                'inventory', 'Készlet', item.id,
                item.productName || item.drawingNumber || item.id,
                transaction.type,
                {
                  changes: [{ field: 'quantity', label: 'Mennyiség (db)', before: before.quantity, after: item.quantity }],
                  notes: transaction.notes,
                }
              )
            }
          }
          setInventoryTransactions((current) => [...(current || []), transaction])
        }}
      />

      <LabelPrintSettingsDialog
        open={labelPrintSettingsDialogOpen}
        onClose={() => setLabelPrintSettingsDialogOpen(false)}
        onPrint={async (printSettings) => {
          if (selectedOrderIds.length === 0) {
            toast.error('Nincsenek kiválasztott rendelések')
            return
          }
          const selectedOrders = (orders || []).filter(o => selectedOrderIds.includes(o.id))
          const activeTemplate = labelTemplates?.find(t => t.id === activeLabelTemplateId)
          await generateLabelsWithPrintSettings(
            selectedOrders, customers || [], products || [],
            activeTemplate, printSettings, labelTemplates
          )
        }}
        defaultCopies={1}
      />
    </>
  )
}
