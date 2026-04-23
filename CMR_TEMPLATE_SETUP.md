# CMR Template Setup

## Overview
The ProduktívPro application uses an Excel template (`Cmr.xls`) for generating CMR (Convention relative au contrat de transport international de marchandises par route) documents.

## Template Location
The CMR template file is located in the **public/templates** directory:

```
/workspaces/spark-template/public/templates/Cmr.xls
```

## Current Status
✅ **Template is configured and ready to use!**

The template file `Cmr.xls` is already in place at `/workspaces/spark-template/public/templates/Cmr.xls` and the application is configured to use it as the default template.

## How It Works
1. When a user exports CMR documents, the application fetches the template from `/templates/Cmr.xls`
2. The template is loaded using the `xlsx-template` library
3. Placeholders in the template are replaced with actual order data
4. The generated Excel file is downloaded to the user's computer

## Template Requirements
The Excel template should contain placeholders that match the field names used in the CMR data structure. Key placeholders include:

- `senderName` - Sender company name
- `senderAddress` - Sender address
- `senderTaxNumber` - Sender tax number
- `consigneeName` - Consignee/customer name
- `consigneeAddress` - Consignee address
- `consigneeTaxNumber` - Consignee tax number
- `consigneeCity` - Consignee city
- `consigneeCountry` - Consignee country
- `placeOfDelivery` - Delivery location
- `deliveryCountry` - Delivery country
- `placeOfTakingOver` - Pickup location
- `takingOverCountry` - Pickup country
- `marksAndNumbers` - Product identification marks
- `numberOfPackages` - Total package count
- `methodOfPacking` - Packing method description
- `natureOfGoods` - Goods description
- `grossWeightKg` - Total gross weight in kg
- `placeIssued` - Place where document was issued
- `dateIssued` - Date of issuance
- `ownOrderNumber` - Internal order number
- `customerOrderNumber` - Customer's order number
- `deliveryNoteNumber` - Delivery note reference
- `amountPc` - Total quantity in pieces
- `rowCount` - Number of order rows

### Specific Cell Placeholders
For direct cell references in the template, the following placeholders are available:
- `K1` - Delivery note number (Szállítólevél száma)
- `A6` - Customer name (Consignee name)
- `A7` - Customer address (Consignee address)
- `B12` - Customer city (Vevő város)
- `B13` - Customer country (Vevő ország)

### Using Placeholders in Excel
In your `Cmr.xls` template file, use the following syntax to insert placeholders:
```
${placeholderName}
```

For example, to insert the delivery note number in cell K1:
1. Open `Cmr.xls` in Excel
2. Click on cell K1
3. Enter: `${K1}` or `${deliveryNoteNumber}`
4. Save the file

The same pattern applies to all other placeholders listed above.

## Fallback Behavior
If the template file is missing or cannot be loaded, the application will automatically fall back to generating a standard XLSX file with tabular data. A warning toast notification will be displayed to the user.

## File Format
- **Format:** Excel 97-2003 format (`.xls`)
- **Location:** `/workspaces/spark-template/public/templates/Cmr.xls`
- **Library:** `xlsx-template` is used for template processing
- **Compatibility:** The template should be compatible with xlsx-template's substitution syntax

## Troubleshooting

### Template not found
If you see a warning "A CMR sablon nem elérhető, alap táblázatos export készült", it means:
- The file is not in the `public/templates` directory
- The file is not named exactly `Cmr.xls` (case-sensitive)
- The file is corrupted or invalid

### Check if file exists
You can verify the file location:
```bash
ls -la /workspaces/spark-template/public/templates/Cmr.xls
```

### Verify the template loads in browser
Once the application is running, you can test if the file is accessible:
```
http://localhost:5173/templates/Cmr.xls
```
This should trigger a download of the file if properly configured.
