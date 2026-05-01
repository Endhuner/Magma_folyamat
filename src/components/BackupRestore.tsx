import { useState } from 'react'
import { useKV } from '@/hooks/useKV'
import { useEntityKV } from '@/hooks/useEntityKV'
import {
  ordersRepo,
  customersRepo,
  productsRepo,
  deliveryNotesRepo,
} from '@/lib/db/repos'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Order, Customer, Product, DeliveryNote } from '@/lib/types'
import { FloppyDisk, Upload, ArrowCounterClockwise, Warning, CheckCircle, CloudArrowDown, Trash, DownloadSimple, Info } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { hu } from 'date-fns/locale'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { validateBackup } from '@/lib/backupSchema'

interface BackupData {
  version: string
  timestamp: string
  orders: Order[]
  customers: Customer[]
  products: Product[]
  deliveryNotes: DeliveryNote[]
  customerSequences?: Record<string, number>
  cmrSettings?: CmrLayoutSettings
}

interface SavedBackup {
  id: string
  name: string
  timestamp: string
  size: number
  orders: number
  customers: number
  products: number
  deliveryNotes: number
  data: BackupData
}

export function BackupRestore() {
  // Az entitások már IndexedDB-ből jönnek (useEntityKV adapter), de a backup
  // fájl-formátum változatlan — exporthoz az értékeket olvassuk, importhoz
  // a settert hívjuk (a setter diff-et számol a Dexie alá).
  const [orders, setOrders] = useEntityKV<Order>(ordersRepo)
  const [customers, setCustomers] = useEntityKV<Customer>(customersRepo)
  const [products, setProducts] = useEntityKV<Product>(productsRepo)
  const [deliveryNotes, setDeliveryNotes] = useEntityKV<DeliveryNote>(deliveryNotesRepo)
  const [customerSequences] = useKV<Record<string, number>>('customerSequences', {})
  const [cmrSettings] = useKV<CmrLayoutSettings>('cmr-layout-settings', {
    senderName: 'Magma Kft',
    senderAddress: 'H-1211 Budapest, Déli utca 13.',
    senderTaxNumber: 'HU10368152-2-43',
    placeOfTakingOver: 'Budapest, Hungary',
    placeIssued: 'Budapest',
    templateExtension: 'xltx',
    senderCity: 'Budapest',
    senderCountry: 'Magyarország',
    senderPhone: '',
    senderEmail: '',
    carrierName: '',
    carrierAddress: '',
    vehiclePlate: '',
  })
  const [savedBackups, setSavedBackups] = useKV<SavedBackup[]>('backups', [])
  const [isExporting, setIsExporting] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)

  const createBackup = () => {
    setIsExporting(true)
    
    try {
      const backupData: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        orders: orders || [],
        customers: customers || [],
        products: products || [],
        deliveryNotes: deliveryNotes || [],
        customerSequences: customerSequences || {},
        cmrSettings: cmrSettings
      }

      const dataStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `produktivpro-backup-${format(new Date(), 'yyyy-MM-dd-HHmm', { locale: hu })}.json`
      link.click()
      URL.revokeObjectURL(url)

      const backupInfo: SavedBackup = {
        id: `backup-${Date.now()}`,
        name: `Biztonsági mentés ${format(new Date(), 'yyyy. MM. dd. HH:mm', { locale: hu })}`,
        timestamp: new Date().toISOString(),
        size: dataStr.length,
        orders: (orders || []).length,
        customers: (customers || []).length,
        products: (products || []).length,
        deliveryNotes: (deliveryNotes || []).length,
        data: backupData
      }

      setSavedBackups((current) => [...(current || []), backupInfo])

      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-medium">Biztonsági mentés létrehozva!</p>
          <p className="text-xs text-muted-foreground">
            {(orders || []).length} rendelés, {(customers || []).length} vevő, {(products || []).length} termék
          </p>
        </div>,
        { duration: 5000 }
      )
    } catch (error) {
      console.error('Backup error:', error)
      toast.error('Hiba történt a biztonsági mentés létrehozása során')
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        let parsed: unknown
        try {
          parsed = JSON.parse(text)
        } catch {
          toast.error('Hibás JSON fájl — nem lehet beolvasni a tartalmat')
          return
        }

        // Strukturális Zod-validáció — ne engedjük át a sérült/nem megfelelő
        // shape-ű mentéseket a setOrders/setCustomers stb. felé.
        const result = validateBackup(parsed)
        if (!result.success || !result.data) {
          // A Zod hibaüzenet többsoros, ezért description-t használunk a toast-ban.
          toast.error('Érvénytelen biztonsági mentés fájl', {
            description: result.error || 'A fájl nem felel meg a várt sémának.',
            duration: 12000,
          })
          return
        }

        const data = result.data as unknown as BackupData

        toast.warning(
          <div className="flex flex-col gap-1">
            <p className="font-medium">Vissza szeretné állítani az adatokat?</p>
            <p className="text-xs">
              Ez felülírja a jelenlegi adatokat: {data.orders.length} rendelés, {data.customers.length} vevő, {data.products.length} termék
            </p>
          </div>,
          {
            duration: 10000,
            action: {
              label: 'Visszaállítás',
              onClick: () => handleRestoreData(data)
            }
          }
        )
      } catch (error) {
        console.error('Import error:', error)
        toast.error('Hiba történt a fájl beolvasása során')
      }
    }
    input.click()
  }

  const handleRestoreData = async (data: BackupData) => {
    setIsRestoring(true)
    try {
      setOrders(data.orders || [])
      setCustomers(data.customers || [])
      setProducts(data.products || [])
      setDeliveryNotes(data.deliveryNotes || [])
      
      toast.success(
        <div className="flex flex-col gap-1">
          <p className="font-medium">Adatok sikeresen visszaállítva!</p>
          <p className="text-xs text-muted-foreground">
            {data.orders.length} rendelés, {data.customers.length} vevő, {data.products.length} termék
          </p>
        </div>,
        { duration: 5000 }
      )
    } catch (error) {
      console.error('Restore error:', error)
      toast.error('Hiba történt az adatok visszaállítása során')
    } finally {
      setIsRestoring(false)
    }
  }

  const handleRestoreBackup = (backup: SavedBackup) => {
    toast.warning(
      <div className="flex flex-col gap-1">
        <p className="font-medium">Vissza szeretné állítani a mentést?</p>
        <p className="text-xs">Ez felülírja a jelenlegi adatokat: {backup.orders} rendelés, {backup.customers} vevő, {backup.products} termék</p>
      </div>,
      {
        duration: 10000,
        action: {
          label: 'Visszaállítás',
          onClick: () => handleRestoreData(backup.data)
        }
      }
    )
  }

  const handleDownloadBackup = (backup: SavedBackup) => {
    try {
      const dataStr = JSON.stringify(backup.data, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `produktivpro-backup-${format(new Date(backup.timestamp), 'yyyy-MM-dd-HHmm', { locale: hu })}.json`
      link.click()
      URL.revokeObjectURL(url)
      
      toast.success('Biztonsági mentés letöltve')
    } catch (error) {
      console.error('Download error:', error)
      toast.error('Hiba történt a letöltés során')
    }
  }

  const handleDeleteBackup = (id: string) => {
    setSavedBackups((current) => (current || []).filter((b) => b.id !== id))
    toast.success('Biztonsági mentés törölve')
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const totalRecords = (orders || []).length + (customers || []).length + (products || []).length + (deliveryNotes || []).length

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1">Biztonsági mentés</h2>
        <p className="text-muted-foreground">
          Exportálja vagy importálja az összes adatot JSON formátumban
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FloppyDisk className="w-6 h-6 text-primary" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rendelések</p>
              <p className="text-2xl font-bold">{(orders || []).length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-secondary/10">
              <FloppyDisk className="w-6 h-6 text-secondary" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vevők</p>
              <p className="text-2xl font-bold">{(customers || []).length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-accent/10">
              <FloppyDisk className="w-6 h-6 text-accent" weight="duotone" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Termékek</p>
              <p className="text-2xl font-bold">{(products || []).length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertDescription>
          Az <strong>Exportálás</strong> letölti az összes adatot JSON fájlba a számítógépére. 
          Az <strong>Importálás</strong> visszaállítja az adatokat egy korábban mentett fájlból.
          A mentett biztonsági mentéseket tárolhatja a rendszerben, és bármikor visszaállíthatja vagy letöltheti őket.
        </AlertDescription>
      </Alert>

      <div className="flex gap-3">
        <Button onClick={createBackup} disabled={isExporting || isRestoring || totalRecords === 0} className="gap-2">
          <CloudArrowDown className="w-5 h-5" />
          {isExporting ? 'Exportálás...' : 'Biztonsági mentés létrehozása'}
        </Button>
        
        <Button variant="outline" onClick={handleFileImport} disabled={isRestoring} className="gap-2">
          <Upload className="w-5 h-5" />
          {isRestoring ? 'Visszaállítás...' : 'Importálás fájlból'}
        </Button>
      </div>

      {(savedBackups || []).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <FloppyDisk className="w-5 h-5 text-muted-foreground" weight="duotone" />
            <h3 className="text-lg font-semibold">Mentett biztonsági mentések</h3>
          </div>

          <div className="space-y-3">
            {(savedBackups || []).map((backup) => (
              <Card key={backup.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-success" weight="fill" />
                      <h4 className="font-semibold">{backup.name}</h4>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Dátum:</span>
                        <p className="font-medium">
                          {format(new Date(backup.timestamp), 'yyyy. MM. dd.', { locale: hu })}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Rendelések:</span>
                        <p className="font-medium font-mono">{backup.orders}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Vevők:</span>
                        <p className="font-medium font-mono">{backup.customers}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Termékek:</span>
                        <p className="font-medium font-mono">{backup.products}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Méret:</span>
                        <p className="font-medium font-mono">{formatFileSize(backup.size)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleRestoreBackup(backup)}
                      title="Visszaállítás"
                    >
                      <ArrowCounterClockwise className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownloadBackup(backup)}
                      title="Letöltés"
                    >
                      <DownloadSimple className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteBackup(backup.id)}
                      title="Törlés"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {totalRecords === 0 && (
        <Card className="p-12 text-center">
          <FloppyDisk className="w-16 h-16 text-muted-foreground mx-auto mb-4" weight="duotone" />
          <h3 className="text-lg font-semibold mb-2">Nincs adat</h3>
          <p className="text-muted-foreground">
            Nincs adat a biztonsági mentéshez. Kezdje el az adatok felvételével.
          </p>
        </Card>
      )}
    </div>
  )
}
