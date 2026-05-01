/**
 * Apró segédmodul Excel/CSV blob letöltéshez böngészőben.
 *
 * Korábban itt volt egy `generateCmrTemplateWorkbook` is, amely a
 * Node.js-only `xlsx-template` csomagra épült és böngészőben mindig
 * hibát dobott. Az érvényes CMR/szállítólevél Excel-export logika a
 * `cmrDirectExport.ts`, `cmrExcelJSExport.ts` és `deliveryExcelJSExport.ts`
 * modulokban él, mind ExcelJS-szel készülnek.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()

  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}
