import { useEffect, useRef } from 'react'
import { DEFAULT_DELIVERY_TEMPLATE_HTML, DEFAULT_DELIVERY_TEMPLATE_CSS } from '@/lib/defaultDeliveryTemplate'
import { DEFAULT_CMR_TEMPLATE_HTML, DEFAULT_CMR_TEMPLATE_CSS } from '@/lib/defaultCmrTemplate'

const DELIVERY_DEFAULT_ID = 'template-delivery-default'
const CMR_DEFAULT_ID = 'template-cmr-default'

interface SavedTemplateApi {
  items: Array<{ id?: string; name?: string; [key: string]: unknown }>
  loading?: boolean
  add: (item: unknown) => void
}

export function useDefaultTemplates(savedTemplatesApi: SavedTemplateApi) {
  const initialized = useRef(false)

  useEffect(() => {
    // Várjuk meg amíg a szerver válasza megérkezik — loading=true vagy üres tömb loading közben
    if (savedTemplatesApi.loading) return
    if (initialized.current) return
    initialized.current = true

    const hasDelivery = savedTemplatesApi.items.some(t => t.id === DELIVERY_DEFAULT_ID)
    if (!hasDelivery) {
      savedTemplatesApi.add({
        id: DELIVERY_DEFAULT_ID,
        name: 'Szállítólevél Sablon (alapértelmezett)',
        timestamp: new Date('2026-03-13T12:32:00').toISOString(),
        size: JSON.stringify({ html: DEFAULT_DELIVERY_TEMPLATE_HTML, css: DEFAULT_DELIVERY_TEMPLATE_CSS }).length,
        data: {
          id: DELIVERY_DEFAULT_ID,
          name: 'Szállítólevél Sablon (alapértelmezett)',
          type: 'delivery' as const,
          html: DEFAULT_DELIVERY_TEMPLATE_HTML,
          css: DEFAULT_DELIVERY_TEMPLATE_CSS,
          timestamp: new Date('2026-03-13T12:32:00').toISOString(),
          description: 'Alapértelmezett szállítólevél sablon',
          margins: { top: '10', right: '10', bottom: '10', left: '10' },
        },
      })
    }

    const hasCmr = savedTemplatesApi.items.some(t => t.id === CMR_DEFAULT_ID)
    if (!hasCmr) {
      savedTemplatesApi.add({
        id: CMR_DEFAULT_ID,
        name: 'CMR Sablon (alapértelmezett)',
        timestamp: new Date('2026-03-13T12:42:00').toISOString(),
        size: JSON.stringify({ html: DEFAULT_CMR_TEMPLATE_HTML, css: DEFAULT_CMR_TEMPLATE_CSS }).length,
        data: {
          id: CMR_DEFAULT_ID,
          name: 'CMR Sablon (alapértelmezett)',
          type: 'cmr' as const,
          html: DEFAULT_CMR_TEMPLATE_HTML,
          css: DEFAULT_CMR_TEMPLATE_CSS,
          timestamp: new Date('2026-03-13T12:42:00').toISOString(),
          description: 'Alapértelmezett CMR sablon',
          margins: { top: '10', right: '10', bottom: '10', left: '10' },
        },
      })
    }
  }, [savedTemplatesApi.items, savedTemplatesApi.loading])
}
