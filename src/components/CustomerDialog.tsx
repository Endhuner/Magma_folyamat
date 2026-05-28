import { generateId } from '@/lib/generateId'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Customer } from '@/lib/types'
import { LabelTemplate } from '@/lib/labelTemplate'
import { Separator } from '@/components/ui/separator'

interface SavedTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  timestamp: string
}

interface CustomerDialogProps {
  open: boolean
  onClose: () => void
  onSave: (customer: Partial<Customer>) => void
  customer?: Customer | null
  savedTemplates?: SavedTemplate[]
  labelTemplates?: LabelTemplate[]
}

export function CustomerDialog({ open, onClose, onSave, customer, savedTemplates, labelTemplates }: CustomerDialogProps) {
  const [formData, setFormData] = useState({
    name: customer?.name || '',
    language: customer?.language || '',
    city: customer?.city || '',
    postalCode: customer?.postalCode || '',
    street: customer?.street || '',
    country: customer?.country || '',
    fullAddress: customer?.fullAddress || '',
    taxNumber: customer?.taxNumber || '',
    deliveryTemplateId: customer?.deliveryTemplateId || null,
    cmrTemplateId: customer?.cmrTemplateId || null,
    labelTemplateId: customer?.labelTemplateId || null,
    email: customer?.email || '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const customerData: Partial<Customer> = {
      ...customer,
      name: formData.name,
      language: formData.language,
      city: formData.city,
      postalCode: formData.postalCode,
      street: formData.street,
      country: formData.country,
      fullAddress: formData.fullAddress,
      taxNumber: formData.taxNumber,
      deliveryTemplateId: formData.deliveryTemplateId,
      cmrTemplateId: formData.cmrTemplateId,
      labelTemplateId: formData.labelTemplateId,
      email: formData.email,
      updatedAt: new Date().toISOString(),
    }

    if (!customer) {
      customerData.id = generateId()
      customerData.createdAt = new Date().toISOString()
    }

    onSave(customerData)
    onClose()
  }

  const deliveryTemplates = (savedTemplates || []).filter(t => t.type === 'delivery')
  const cmrTemplates = (savedTemplates || []).filter(t => t.type === 'cmr')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'Vevő Szerkesztése' : 'Új Vevő'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vevő Név *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="language">Szállító Nyelve *</Label>
              <Input
                id="language"
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Város *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="postalCode">Irányítószám *</Label>
                <Input
                  id="postalCode"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="street">Utca, Házszám *</Label>
              <Input
                id="street"
                value={formData.street}
                onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="country">Ország *</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="fullAddress">Cím *</Label>
              <Input
                id="fullAddress"
                value={formData.fullAddress}
                onChange={(e) => setFormData({ ...formData, fullAddress: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="taxNumber">Adószám *</Label>
              <Input
                id="taxNumber"
                value={formData.taxNumber}
                onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email-cím</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="pl. info@ceg.hu"
              />
            </div>

            <Separator className="my-4" />

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Sablonok hozzárendelése</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ezek a sablonok automatikusan használva lesznek ennél a vevőnél
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliveryTemplate">Szállítólevél Sablon</Label>
                <Select
                  value={formData.deliveryTemplateId || 'none'}
                  onValueChange={(value) => 
                    setFormData({ ...formData, deliveryTemplateId: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="deliveryTemplate">
                    <SelectValue placeholder="Alapértelmezett használata" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alapértelmezett használata</SelectItem>
                    {deliveryTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cmrTemplate">CMR Sablon</Label>
                <Select
                  value={formData.cmrTemplateId || 'none'}
                  onValueChange={(value) => 
                    setFormData({ ...formData, cmrTemplateId: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="cmrTemplate">
                    <SelectValue placeholder="Alapértelmezett használata" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alapértelmezett használata</SelectItem>
                    {cmrTemplates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="labelTemplate">Címke Sablon</Label>
                <Select
                  value={formData.labelTemplateId || 'none'}
                  onValueChange={(value) => 
                    setFormData({ ...formData, labelTemplateId: value === 'none' ? null : value })
                  }
                >
                  <SelectTrigger id="labelTemplate">
                    <SelectValue placeholder="Alapértelmezett használata" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Alapértelmezett használata</SelectItem>
                    {(labelTemplates || []).map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit">
              {customer ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
