/**
 * Code-splitting belépőpontok a nagyobb (vagy ritkán használt) komponensekhez.
 *
 * Vite a `React.lazy(() => import(...))` mintát automatikusan külön JS-chunkba
 * teszi. Az így betöltődő komponens csak akkor jön le hálózatról, amikor a
 * felhasználó megnyitja a hozzá tartozó dialógust / fület — így a kezdő
 * bundle (initial paint) jóval gyorsabb lesz.
 *
 * Mivel a komponensek named export-tal vannak, kis shim-et használunk:
 * `then(m => ({ default: m.X }))` — így nem kell minden fájlt átírni.
 */
import { lazy } from 'react'

/** ~1400 sor, Monaco-szerű színkijelölős sablon-szerkesztő. Ritkán használt. */
export const GithubStyleTemplateEditor = lazy(() =>
  import('@/components/GithubStyleTemplateEditor').then((m) => ({
    default: m.GithubStyleTemplateEditor,
  }))
)

/** ~550 sor, csak címke-sablon szerkesztéskor jelenik meg. */
export const LabelTemplateDialog = lazy(() =>
  import('@/components/LabelTemplateDialog').then((m) => ({
    default: m.LabelTemplateDialog,
  }))
)

/** ~270 sor, CMR beállítások — csak a nyitott dialógus kéri. */
export const CmrSettingsDialog = lazy(() =>
  import('@/components/CmrSettingsDialog').then((m) => ({
    default: m.CmrSettingsDialog,
  }))
)

/** ~220 sor, Szállítólevél stílus beállítások. */
export const DeliverySettingsDialog = lazy(() =>
  import('@/components/DeliverySettingsDialog').then((m) => ({
    default: m.DeliverySettingsDialog,
  }))
)

/** ~410 sor, sablon backup/restore. Csak a `template-saves` tabon kell. */
export const TemplateBackupRestore = lazy(() =>
  import('@/components/TemplateBackupRestore').then((m) => ({
    default: m.TemplateBackupRestore,
  }))
)

/** ~270 sor, OrderBulkImport CSV/Excel parser — csak importnál tölt. */
export const OrderBulkImportDialog = lazy(() =>
  import('@/components/OrderBulkImportDialog').then((m) => ({
    default: m.OrderBulkImportDialog,
  }))
)

/** ~250 sor, ProductBulkImport. */
export const ProductBulkImportDialog = lazy(() =>
  import('@/components/ProductBulkImportDialog').then((m) => ({
    default: m.ProductBulkImportDialog,
  }))
)

/** ~220 sor, Customer BulkImport. */
export const BulkImportDialog = lazy(() =>
  import('@/components/BulkImportDialog').then((m) => ({
    default: m.BulkImportDialog,
  }))
)
