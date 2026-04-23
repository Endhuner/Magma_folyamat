# Iteration 5: Custom CMR Template Fields Implementation

## Overview
Enhanced the CMR export system to properly use the custom field settings configured in the CMR Settings dialog. The system now respects user preferences for company information, optional CMR fields, and custom default values.

## Changes Made

### 1. **Updated CMR Template Export (`xlsxTemplateExport.ts`)**
   - Modified `buildCmrTemplateValues()` to accept `CmrLayoutSettings` parameter
   - Added support for custom sender information (name, address, tax number)
   - Added support for custom place information (place of taking over, place issued)
   - Implemented conditional field inclusion based on `cmrFields` settings:
     - Carrier information
     - Successive carriers
     - Documents attached
     - Cash on delivery
     - Sender instructions
     - Payment directions
     - Carrier reservations
     - Special agreements
     - Vehicle registration (enabled by default)
     - Statistical number
     - Volume m³
   - Added material and surface treatment fields when `showOrderDetails` is enabled
   - Added notes fields when `includeNotes` is enabled
   - Updated `generateCmrTemplateWorkbook()` to pass settings to the builder

### 2. **Enhanced Export Preview Dialog (`ExportPreviewDialog.tsx`)**
   - Added `useKV` hook to load saved CMR settings
   - Updated `buildExportData()` to use effective CMR settings for all CMR fields
   - Modified CMR export rows to populate fields based on user configuration:
     - Sender details use configured company information
     - Optional fields only show when enabled in settings
     - Default values from settings are automatically filled in
   - Updated `handleExport()` to pass CMR settings to the template generator
   - Updated `handleExportCmrHtml()` to pass settings to HTML generator
   - Added fallback to DEFAULT_CMR_SETTINGS for backward compatibility

### 3. **Default CMR Settings**
   Defined comprehensive default settings in `ExportPreviewDialog.tsx`:
   ```typescript
   - Sender: Magma Kft, Budapest address
   - All display sections enabled by default
   - Vehicle registration field enabled
   - All other optional fields disabled (can be enabled in settings)
   ```

## How It Works

### Configuration Flow
1. User opens "CMR beállítások" dialog
2. Configures company information, optional fields, and default values
3. Settings are saved to persistent storage using `useKV`
4. Settings persist across sessions

### Export Flow
1. User selects orders and clicks "CMR" export button
2. System loads saved CMR settings (or uses defaults)
3. Export data is built using the configured settings:
   - Company information is automatically populated
   - Enabled optional fields appear with their default values
   - Disabled fields are omitted or left empty
4. CMR template (Excel or HTML) is generated with personalized data
5. User downloads properly formatted CMR document

## Benefits

### For Users
- **Personalized Documents**: Company information auto-fills correctly
- **Reduced Data Entry**: Default values eliminate repetitive typing
- **Professional Output**: Consistent, branded CMR documents
- **Flexibility**: Enable only the fields you need
- **Time Savings**: Configure once, use repeatedly

### For Business
- **Brand Consistency**: All CMR documents use correct company details
- **Compliance**: Required fields can be enforced through defaults
- **Efficiency**: Faster document generation
- **Accuracy**: Reduces manual entry errors

## Technical Implementation

### Field Mapping
The system maps CMR settings to both:
1. **Excel Template Placeholders**: Values substituted in the Cmr.xls template
2. **Export Data Columns**: Structured data for table view and HTML export

### Backward Compatibility
- Existing exports without settings use sensible defaults
- Template fallback ensures exports work even if settings are incomplete
- All original functionality preserved

### Data Persistence
- Settings stored in `cmr-layout-settings` KV key
- Automatically loaded when export dialog opens
- Merged with defaults to handle missing fields

## Usage Example

### Configuring CMR Settings
1. Click "CMR beállítások" button in header
2. Fill in company information:
   - Feladó név: Your Company Name
   - Feladó cím: Your Address
   - Feladó adószám: Your Tax Number
3. Enable optional fields you need (e.g., Vehicle Registration)
4. Enter default values for enabled fields
5. Click "Mentés" to save

### Generating CMR Export
1. Select orders in the Orders tab
2. Click "CMR" button
3. Review preview with pre-filled company information
4. Optional: Edit delivery note number
5. Click "Excel letöltés" or "CMR HTML letöltés"
6. Download includes your configured information

## Custom Fields Available

### Always Included
- Sender information (company name, address, tax number)
- Consignee information (from customer database)
- Delivery locations
- Package details (boxes, pallets)
- Goods description
- Weight information
- Issue date and location
- Order numbers

### Configurable Optional Fields
1. **16. Fuvarozó** - Carrier information
2. **17. További fuvarozók** - Successive carriers
3. **5. Mellékelt okmányok** - Attached documents
4. **14. Visszatérítés** - Cash on delivery
5. **13. Feladó rendelkezései** - Sender instructions
6. **15. Fuvardíjfizetési meghagyások** - Payment directions
7. **18. Fuvarozó fenntartásai** - Carrier reservations
8. **20. Egyedi megállapodások** - Special agreements
9. **25. Jármű rendszám** - Vehicle registration (default: enabled)
10. **10. Statisztikai szám** - Statistical number
11. **12. Térfogat m³** - Volume in cubic meters

## Files Modified
- `/src/lib/xlsxTemplateExport.ts` - Enhanced template value builder
- `/src/components/ExportPreviewDialog.tsx` - Integrated settings into export
- `/src/components/CmrSettingsDialog.tsx` - Already had the UI (no changes needed)
- `/src/lib/cmrTemplateBuilder.ts` - Already supported settings parameter

## Next Steps
Users can now:
1. Configure their business-specific CMR defaults
2. Enable/disable optional fields as needed
3. Generate professional CMR documents with one click
4. Export to Excel (.xlsx) or HTML format
5. Print or email CMR documents directly
