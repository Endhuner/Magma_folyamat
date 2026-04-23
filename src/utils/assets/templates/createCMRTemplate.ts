import ExcelJS from 'exceljs'

export async function createCMRTemplate(): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  
  try {
    const response = await fetch('/templates/Cmr.xls')
    if (!response.ok) {
      throw new Error(`CMR sablon nem található: ${response.statusText}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    await workbook.xlsx.load(arrayBuffer)
    
    return workbook
  } catch (error) {
    console.error('Hiba a CMR sablon betöltése során:', error)
    throw new Error('CMR sablon betöltése sikertelen. Ellenőrizd, hogy a Cmr.xls fájl létezik a /public/templates mappában.')
  }
}

export async function saveCMRTemplate(): Promise<ArrayBuffer> {
  const workbook = await createCMRTemplate()
  const buffer = await workbook.xlsx.writeBuffer()
  return buffer
}
