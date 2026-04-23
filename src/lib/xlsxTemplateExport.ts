import { CmrLayoutSettings } from './cmrTemplateBuilder'

type ExportRow = Record<string, string | number | null | undefined>

const EXCEL_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

interface XlsxTemplateInstance {
  substitute: (sheetNumber: number, values: Record<string, string | number>) => void
  generate: (options?: { type?: string }) => ArrayBuffer | Uint8Array | string
}

interface XlsxTemplateCtor {
  new (templateData: ArrayBuffer): XlsxTemplateInstance
}

interface GenerateCmrTemplateOptions {
  rows: ExportRow[]
  templateUrl?: string
  sheetNumber?: number
  settings?: CmrLayoutSettings
}

const getFieldValue = (row: ExportRow, field: string): string | number => row[field] ?? ''

const parseNumeric = (value: string | number): number => {
  if (typeof value === 'number') return value
  const matched = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/)
  return matched ? Number(matched[0]) : 0
}

const joinUnique = (rows: ExportRow[], field: string) => {
  return rows
    .map(row => String(getFieldValue(row, field)).trim())
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .join(', ')
}

function buildCmrTemplateValues(rows: ExportRow[], settings?: CmrLayoutSettings): Record<string, string | number> {
  const first = rows[0] ?? {}
  
  console.log('=== CMR Template Values Building ===')
  console.log('Rows count:', rows.length)
  console.log('First row data:', first)

  const totalPackages = rows.reduce((sum, row) => sum + parseNumeric(getFieldValue(row, 'Dobozok száma')), 0)
  const totalGrossWeight = rows.reduce((sum, row) => sum + parseNumeric(getFieldValue(row, 'Bruttó súly')), 0)
  const totalAmount = rows.reduce((sum, row) => sum + parseNumeric(getFieldValue(row, 'Mennyiség (db)')), 0)

  const deliveryNoteNumber = String(getFieldValue(first, 'Szállítólevél száma'))
  const consigneeName = String(getFieldValue(first, 'Vevő'))
  const consigneeFullAddress = String(getFieldValue(first, 'Vevő cím'))
  const consigneeCity = String(getFieldValue(first, 'Város'))
  const consigneeCountry = String(getFieldValue(first, 'Ország'))
  
  console.log('Extracted values:')
  console.log('  Szállítólevél száma (K1):', deliveryNoteNumber)
  console.log('  Vevő (A6):', consigneeName)
  console.log('  Vevő cím (A7):', consigneeFullAddress)
  console.log('  Város (B12):', consigneeCity)
  console.log('  Ország (B13):', consigneeCountry)
  console.log('Settings values:')
  console.log('  Feladó város:', settings?.senderCity)
  console.log('  Feladó ország:', settings?.senderCountry)
  console.log('  Fuvarozó név:', settings?.carrierName)
  console.log('  Fuvarozó cím:', settings?.carrierAddress)
  console.log('  Rendszám:', settings?.vehiclePlate)

  const senderCity = settings?.senderCity || 'Budapest'
  const senderCountry = settings?.senderCountry || 'Magyarország'
  const carrierName = settings?.carrierName || ''
  const carrierAddress = settings?.carrierAddress || ''
  const vehiclePlate = settings?.vehiclePlate || ''
  const senderPhone = settings?.senderPhone || ''
  const senderEmail = settings?.senderEmail || ''

  const baseValues: Record<string, string | number> = {
    K1: deliveryNoteNumber,
    A6: consigneeName,
    A7: consigneeFullAddress,
    B12: consigneeCity,
    B13: consigneeCountry,
    
    szallitolevel_szama: deliveryNoteNumber,
    customer_name: consigneeName,
    customer_address: consigneeFullAddress,
    customer_city: consigneeCity,
    customer_country: consigneeCountry,
    
    senderName: settings?.senderName || 'Magma Kft',
    senderAddress: settings?.senderAddress || 'H-1211 Budapest, Déli utca 13.',
    senderTaxNumber: settings?.senderTaxNumber || 'HU10368152-2-43',
    senderCity,
    senderCountry,
    senderPhone,
    senderEmail,
    
    carrierName,
    carrierAddress,
    vehiclePlate,
    
    consigneeName,
    consigneeAddress: consigneeFullAddress,
    consigneeCity,
    consigneeCountry,
    placeOfTakingOver: settings?.placeOfTakingOver || 'Budapest, Hungary',
    placeIssued: settings?.placeIssued || 'Budapest',
    dateIssued: new Date().toLocaleDateString('hu-HU'),
    numberOfPackages: totalPackages,
    grossWeightKg: totalGrossWeight,
    amountPc: totalAmount,
    rowCount: rows.length,
  }
  
  console.log('Built template values:', baseValues)
  console.log('=== End CMR Template Values ===')

  return baseValues
}

async function loadXlsxTemplateCtor(): Promise<XlsxTemplateCtor> {
  throw new Error('Az xlsx-template csak Node.js környezetben működik. Használja az ExcelJS alapú exportot helyette (cmrDirectExport.ts vagy deliveryExcelJSExport.ts)')
}

function decodeBase64ToUint8Array(base64Data: string): Uint8Array {
  const binary = atob(base64Data)
  const bytes = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }

  return bytes
}

function generateTemplateBinary(template: XlsxTemplateInstance): Uint8Array | ArrayBuffer {
  const generationTypes = ['uint8array', 'arraybuffer', 'nodebuffer', 'base64']

  for (const type of generationTypes) {
    try {
      const generated = template.generate({ type })
      if (generated instanceof Uint8Array || generated instanceof ArrayBuffer) {
        return generated
      }
      if (typeof generated === 'string' && generated.length > 0) {
        return decodeBase64ToUint8Array(generated)
      }
    } catch {
      // Continue with next type because xlsx-template supports different runtimes.
    }
  }

  throw new Error('Nem sikerult a template alapu Excel generalas')
}

export async function generateCmrTemplateWorkbook({
  rows,
  templateUrl = '/Cmr.xltx',
  sheetNumber = 1,
  settings,
}: GenerateCmrTemplateOptions): Promise<Blob> {
  if (!rows.length) {
    throw new Error('Nincsen exportalhato adat')
  }

  const extension = settings?.templateExtension || 'xltx'
  
  const templatePaths = [
    '/templates/Cmr.xls',
    `/templates/Cmr.${extension}`,
    '/templates/Cmr.xltx',
    `/Cmr.${extension}`,
    '/Cmr.xltx',
    '/Cmr.xls'
  ]

  let response: Response | null = null
  let usedPath = ''

  console.log('=== CMR Sablon Betöltés Kezdése ===')
  console.log('Keresett kiterjesztés:', extension)
  console.log('Próbált útvonalak:', templatePaths)

  for (const path of templatePaths) {
    try {
      console.log(`Próbálkozás: ${path}`)
      const testResponse = await fetch(path)
      console.log(`  Válasz státusza: ${testResponse.status}, OK: ${testResponse.ok}`)
      if (testResponse.ok) {
        response = testResponse
        usedPath = path
        console.log(`✓ CMR sablon sikeresen betöltve: ${path}`)
        break
      }
    } catch (err) {
      console.warn(`✗ Nem sikerült betölteni: ${path}`, err)
    }
  }
  
  if (!response || !response.ok) {
    const error = `A CMR sablon nem elérhető egyik útvonalon sem. Próbált útvonalak: ${templatePaths.join(', ')}`
    console.error(error)
    throw new Error(error)
  }

  console.log(`✓ Használt sablon: ${usedPath}`)

  const templateData = await response.arrayBuffer()
  console.log(`✓ Sablon mérete: ${templateData.byteLength} byte`)
  
  const XlsxTemplate = await loadXlsxTemplateCtor()
  console.log('✓ XlsxTemplate konstruktor betöltve')
  
  const workbook = new XlsxTemplate(templateData)
  console.log('✓ Workbook példány létrehozva')

  const substitutionValues = buildCmrTemplateValues(rows, settings)
  console.log('✓ Helyettesítési értékek elkészítve:', Object.keys(substitutionValues).length, 'kulcs')
  
  workbook.substitute(sheetNumber, substitutionValues)
  console.log('✓ Adatok behelyettesítve a sablonba')
  
  const generated = generateTemplateBinary(workbook)
  console.log('✓ Template bináris generálva, típus:', generated.constructor.name)
  
  const normalizedBuffer = generated instanceof Uint8Array ? new Uint8Array(generated).buffer : generated
  const blob = new Blob([normalizedBuffer], { type: EXCEL_MIME_TYPE })
  
  console.log(`✓ Blob létrehozva, méret: ${blob.size} byte`)
  console.log('=== CMR Sablon Betöltés Befejezve ===')

  return blob
}

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
