import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useKV } from '@github/spark/hooks'
import { FloppyDisk, ArrowCounterClockwise, BuildingOffice, Truck } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface DeliverySettings {
  companyName: string
  companyAddress: string
  companyCity: string
  companyCountry: string
  companyPhone: string
  companyEmail: string
  deliveryPrefix: string
  startingNumber: number
}

interface DeliverySettingsDialogProps {
  open: boolean
  onClose: () => void
}

const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  companyName: 'Magma Kft',
  companyAddress: 'H-1211 Budapest, Déli utca 13.',
  companyCity: 'Budapest',
  companyCountry: 'Magyarország',
  companyPhone: '',
  companyEmail: '',
  deliveryPrefix: 'SZL',
  startingNumber: 1,
}

export function DeliverySettingsDialog({ open, onClose }: DeliverySettingsDialogProps) {
  const [deliverySettings, setDeliverySettings] = useKV<DeliverySettings>('delivery-settings', DEFAULT_DELIVERY_SETTINGS)
  const [localSettings, setLocalSettings] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (open && deliverySettings) {
      setLocalSettings({...DEFAULT_DELIVERY_SETTINGS, ...deliverySettings})
      setHasChanges(false)
    }
  }, [open, deliverySettings])

  const handleInputChange = (field: keyof DeliverySettings, value: string | number) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    setDeliverySettings(localSettings)
    setHasChanges(false)
    toast.success('Szállítólevél beállítások mentve')
    onClose()
  }

  const handleReset = () => {
    setLocalSettings(DEFAULT_DELIVERY_SETTINGS)
    setHasChanges(true)
    toast.success('Alapértelmezett beállítások visszaállítva')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Szállítólevél Export beállítások
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Állítsd be a szállítólevél exportban megjelenő cégadatokat
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BuildingOffice className="w-4 h-4" />
                Cégadatok
              </CardTitle>
              <CardDescription>
                Ezek az adatok automatikusan bekerülnek a szállítólevél dokumentumba
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Cégnév</Label>
                  <Input
                    id="companyName"
                    value={localSettings.companyName}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyPhone">Telefon</Label>
                  <Input
                    id="companyPhone"
                    value={localSettings.companyPhone}
                    onChange={(e) => handleInputChange('companyPhone', e.target.value)}
                    placeholder="+36 1 234 5678"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Cím</Label>
                <Input
                  id="companyAddress"
                  value={localSettings.companyAddress}
                  onChange={(e) => handleInputChange('companyAddress', e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="companyCity">Város</Label>
                  <Input
                    id="companyCity"
                    value={localSettings.companyCity}
                    onChange={(e) => handleInputChange('companyCity', e.target.value)}
                    placeholder="Budapest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyCountry">Ország</Label>
                  <Input
                    id="companyCountry"
                    value={localSettings.companyCountry}
                    onChange={(e) => handleInputChange('companyCountry', e.target.value)}
                    placeholder="Magyarország"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={localSettings.companyEmail}
                  onChange={(e) => handleInputChange('companyEmail', e.target.value)}
                  placeholder="info@magma.hu"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sorszámozás</CardTitle>
              <CardDescription>
                Szállítólevél azonosító formátumának beállítása
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryPrefix">Előtag</Label>
                  <Input
                    id="deliveryPrefix"
                    value={localSettings.deliveryPrefix}
                    onChange={(e) => handleInputChange('deliveryPrefix', e.target.value)}
                    placeholder="SZL"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pl. "SZL" eredményezi: SZL-2025-0001
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startingNumber">Kezdő sorszám</Label>
                  <Input
                    id="startingNumber"
                    type="number"
                    value={localSettings.startingNumber}
                    onChange={(e) => handleInputChange('startingNumber', parseInt(e.target.value) || 1)}
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Évente újrainduló sorszám
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-2"
          >
            <ArrowCounterClockwise className="w-4 h-4" />
            Alapértelmezett
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
          >
            Mégse
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="gap-2"
          >
            <FloppyDisk className="w-4 h-4" />
            Mentés
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
