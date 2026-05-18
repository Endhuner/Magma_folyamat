import { useEffect } from 'react'
import { DEFAULT_DELIVERY_TEMPLATE_HTML, DEFAULT_DELIVERY_TEMPLATE_CSS } from '@/lib/defaultDeliveryTemplate'
import { DEFAULT_CMR_TEMPLATE_HTML, DEFAULT_CMR_TEMPLATE_CSS } from '@/lib/defaultCmrTemplate'

interface SavedTemplateApi {
  items: Array<{ name?: string; [key: string]: unknown }>
  add: (item: unknown) => void
}

export function useDefaultTemplates(savedTemplatesApi: SavedTemplateApi) {
  useEffect(() => {
    if (savedTemplatesApi.items === undefined) return

    const deliveryTemplateName = 'Szállítólevél Sablon - 2026.03.13 12:32'
    const deliveryTemplateExists = savedTemplatesApi.items.some(t => t.name === deliveryTemplateName)

    if (!deliveryTemplateExists) {
      const newTemplateId = `template-delivery-${Date.now()}`
      savedTemplatesApi.add({
        id: newTemplateId,
        name: deliveryTemplateName,
        timestamp: new Date('2026-03-13T12:32:00').toISOString(),
        size: JSON.stringify({ html: DEFAULT_DELIVERY_TEMPLATE_HTML, css: DEFAULT_DELIVERY_TEMPLATE_CSS }).length,
        data: {
          id: newTemplateId,
          name: deliveryTemplateName,
          type: 'delivery' as const,
          html: DEFAULT_DELIVERY_TEMPLATE_HTML,
          css: DEFAULT_DELIVERY_TEMPLATE_CSS,
          timestamp: new Date('2026-03-13T12:32:00').toISOString(),
          description: 'Alapértelmezett szállítólevél sablon',
          margins: { top: '10', right: '10', bottom: '10', left: '10' },
        },
      })
    }

    const cmrTemplateName = 'CMR Sablon - 2026.03.13 12:42'
    const cmrTemplateExists = savedTemplatesApi.items.some(t => t.name === cmrTemplateName)

    if (!cmrTemplateExists) {
      const newCmrTemplateId = `template-cmr-${Date.now()}`
      savedTemplatesApi.add({
        id: newCmrTemplateId,
        name: cmrTemplateName,
        timestamp: new Date('2026-03-13T12:42:00').toISOString(),
        size: JSON.stringify({ html: DEFAULT_CMR_TEMPLATE_HTML, css: DEFAULT_CMR_TEMPLATE_CSS }).length,
        data: {
          id: newCmrTemplateId,
          name: cmrTemplateName,
          type: 'cmr' as const,
          html: DEFAULT_CMR_TEMPLATE_HTML,
          css: DEFAULT_CMR_TEMPLATE_CSS,
          timestamp: new Date('2026-03-13T12:42:00').toISOString(),
          description: 'Alapértelmezett CMR sablon',
          margins: { top: '10', right: '10', bottom: '10', left: '10' },
        },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTemplatesApi.items.length])
}
