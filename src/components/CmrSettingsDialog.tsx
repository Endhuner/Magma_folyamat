import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useKV } from '@github/spark/hooks'
import { CmrLayoutSettings } from '@/lib/cmrTemplateBuilder'
import { GearSix, FloppyDisk, ArrowCounterClockwise, CheckCircle, BuildingOffice } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface CmrSettingsDialogProps {
  open: boolean
  onClose: () => void
}

const DEFAULT_CMR_SETTINGS: CmrLayoutSettings = {
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
}

export function CmrSettingsDialog({ open, onClose }: CmrSettingsDialogProps) {
  const [cmrSettings, setCmrSettings] = useKV<CmrLayoutSettings>('cmr-layout-settings', DEFAULT_CMR_SETTINGS)
  const [localSettings, setLocalSettings] = useState<CmrLayoutSettings>(DEFAULT_CMR_SETTINGS)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (open && cmrSettings) {
      setLocalSettings({...DEFAULT_CMR_SETTINGS, ...cmrSettings})
      setHasChanges(false)
    }
  }, [open, cmrSettings])

  const handleInputChange = (field: keyof CmrLayoutSettings, value: string) => {
    setLocalSettings(prev => ({
      ...prev,
      [field]: value
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    setCmrSettings(localSettings)
    setHasChanges(false)
    toast.success('CMR beállítások mentve')
    onClose()
  }

  const handleReset = () => {
    setLocalSettings(DEFAULT_CMR_SETTINGS)
    setHasChanges(true)
    toast.success('Alapértelmezett beállítások visszaállítva')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GearSix className="w-5 h-5" />
            CMR Export beállítások
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Állítsd be, hogy milyen információk jelenjenek meg a CMR exportban (HTML+CSS sablon alapú)
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BuildingOffice className="w-4 h-4" />
                Feladó adatok
              </CardTitle>
              <CardDescription>
                Cégadatok, melyek automatikusan bekerülnek a CMR dokumentumba
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderName">Feladó név</Label>
                  <Input
                    id="senderName"
                    value={localSettings.senderName}
                    onChange={(e) => handleInputChange('senderName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderTaxNumber">Feladó adószám</Label>
                  <Input
                    id="senderTaxNumber"
                    value={localSettings.senderTaxNumber}
                    onChange={(e) => handleInputChange('senderTaxNumber', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="senderAddress">Feladó cím</Label>
                <Input
                  id="senderAddress"
                  value={localSettings.senderAddress}
                  onChange={(e) => handleInputChange('senderAddress', e.target.value)}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderCity">Feladó város</Label>
                  <Input
                    id="senderCity"
                    value={localSettings.senderCity || ''}
                    onChange={(e) => handleInputChange('senderCity', e.target.value)}
                    placeholder="Budapest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderCountry">Feladó ország</Label>
                  <Input
                    id="senderCountry"
                    value={localSettings.senderCountry || ''}
                    onChange={(e) => handleInputChange('senderCountry', e.target.value)}
                    placeholder="Magyarország"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="senderPhone">Feladó telefon (opcionális)</Label>
                  <Input
                    id="senderPhone"
                    value={localSettings.senderPhone || ''}
                    onChange={(e) => handleInputChange('senderPhone', e.target.value)}
                    placeholder="+36 1 234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderEmail">Feladó email (opcionális)</Label>
                  <Input
                    id="senderEmail"
                    type="email"
                    value={localSettings.senderEmail || ''}
                    onChange={(e) => handleInputChange('senderEmail', e.target.value)}
                    placeholder="info@magma.hu"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="placeOfTakingOver">Áru átvétel helye</Label>
                  <Input
                    id="placeOfTakingOver"
                    value={localSettings.placeOfTakingOver}
                    onChange={(e) => handleInputChange('placeOfTakingOver', e.target.value)}
                    placeholder="Budapest, Hungary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="placeIssued">Kiállítás helye</Label>
                  <Input
                    id="placeIssued"
                    value={localSettings.placeIssued}
                    onChange={(e) => handleInputChange('placeIssued', e.target.value)}
                    placeholder="Budapest"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fuvarozó és szállítási adatok</CardTitle>
              <CardDescription>
                Opcionális adatok a szállítmányozáshoz
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="carrierName">Fuvarozó név (opcionális)</Label>
                  <Input
                    id="carrierName"
                    value={localSettings.carrierName || ''}
                    onChange={(e) => handleInputChange('carrierName', e.target.value)}
                    placeholder="Szállítmányozó Kft."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vehiclePlate">Jármű rendszám (opcionális)</Label>
                  <Input
                    id="vehiclePlate"
                    value={localSettings.vehiclePlate || ''}
                    onChange={(e) => handleInputChange('vehiclePlate', e.target.value)}
                    placeholder="ABC-123"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="carrierAddress">Fuvarozó cím (opcionális)</Label>
                <Input
                  id="carrierAddress"
                  value={localSettings.carrierAddress || ''}
                  onChange={(e) => handleInputChange('carrierAddress', e.target.value)}
                  placeholder="1234 Budapest, Példa utca 1."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-accent" />
                Információ
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                <strong>CMR export:</strong> A fenti adatok kerülnek felhasználásra a CMR dokumentumok generálásakor.
              </p>
              <p>
                A CMR dokumentumok HTML+CSS sablon alapon generálódnak (src/lib/cmrHtmlTemplate.ts), így nincs szükség külön Excel sablonok kezelésére.
              </p>
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
