export interface CmrLayoutSettings {
  senderName: string
  senderAddress: string
  senderTaxNumber: string
  placeOfTakingOver: string
  placeIssued: string
  templateExtension?: 'xltx' | 'xls'
  senderCity?: string
  senderCountry?: string
  senderPhone?: string
  senderEmail?: string
  carrierName?: string
  carrierAddress?: string
  vehiclePlate?: string
}
