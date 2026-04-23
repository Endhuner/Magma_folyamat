# Planning Guide

A comprehensive production management system (MES - Manufacturing Execution System) that enables manufacturing teams to track work orders, monitor production progress, manage resources, and analyze performance in real-time.

**Experience Qualities**: 
1. **Efficient** - Streamlined workflows that minimize clicks and enable rapid data entry for shop floor operators
2. **Clear** - Real-time visibility into production status with intuitive visual indicators and progress tracking
3. **Reliable** - Consistent data capture and persistent storage ensuring no production information is lost

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is a full-featured MES system with multiple interconnected modules including work order management, production tracking, resource allocation, quality control, and analytics dashboards. It requires sophisticated state management, data relationships, and multiple user workflows.

## Essential Features

### Work Order Management
- **Functionality**: Create, edit, and manage production work orders with product details, quantities, priorities, and deadlines
- **Purpose**: Central coordination of all manufacturing activities with clear assignment and tracking
- **Trigger**: User clicks "New Work Order" button or selects existing order
- **Progression**: Click New Order → Fill form (product, quantity, priority, due date) → Save → Order appears in active list → Assign to production line
- **Success criteria**: Orders persist across sessions, display accurate status, support filtering by status/priority/date

### Production Tracking
- **Functionality**: Real-time tracking of production progress with start/pause/complete actions and quantity logging
- **Purpose**: Monitor actual vs. planned production, identify bottlenecks, calculate efficiency metrics
- **Trigger**: Operator selects work order and clicks "Start Production"
- **Progression**: Select order → Start production → Log completed quantities → Mark quality issues → Pause if needed → Complete order
- **Success criteria**: Timestamps recorded accurately, progress percentage calculated correctly, status updates reflect in real-time

### Resource Management
- **Functionality**: Track machines, operators, and materials assigned to production with availability status
- **Purpose**: Optimize resource utilization and prevent over-allocation or conflicts
- **Trigger**: User navigates to Resources tab or assigns resources during work order creation
- **Progression**: View resource list → Check availability → Assign to work order → Monitor utilization → Release when complete
- **Success criteria**: Resource conflicts prevented, utilization rates calculated, assignment history maintained

### Quality Control
- **Functionality**: Log quality inspections, defects, and scrap with categorization and root cause tracking
- **Purpose**: Maintain quality standards and identify recurring issues for continuous improvement
- **Trigger**: During production or completion, operator clicks "Log Quality Issue"
- **Progression**: Click Log Issue → Select type (defect/scrap) → Enter quantity → Add notes → Save → Updates order metrics
- **Success criteria**: Quality metrics integrated into order data, defect rates calculated, issues categorized properly

### Dashboard & Analytics
- **Functionality**: Visual analytics showing production efficiency, order completion rates, resource utilization, and quality metrics
- **Purpose**: Enable data-driven decision making and quick identification of performance trends
- **Trigger**: User navigates to Dashboard view
- **Progression**: Load dashboard → View KPI cards → Analyze charts → Filter by date range → Export reports if needed
- **Success criteria**: Charts update with real data, calculations accurate, performance over time visible

### Customer Management
- **Functionality**: Manage customer data with full CRUD operations and bulk import from Excel files
- **Purpose**: Centralize customer information for efficient order tracking and relationship management
- **Trigger**: User navigates to Customers tab or clicks "New Customer"
- **Progression**: View customer list → Add/Edit customer manually → Or bulk import via Excel → Validate data → Save to system
- **Success criteria**: Customer data persists, table displays all fields correctly, bulk import handles validation errors gracefully

### Order Export Functionality
- **Functionality**: Export selected orders to professionally formatted Excel documents using ExcelJS with two document types: Delivery Note (Szállítólevél) and CMR (international transport document). Both are generated programmatically with complete formatting, styling, and data population.
- **Purpose**: Generate shipping and logistics documentation directly from production data with full traceability and compliance
- **Trigger**: User selects orders and clicks "Szállító (ExcelJS)" or "CMR (ExcelJS)" buttons in Orders tab
- **Progression**: Select orders → Click export button → System validates data → ExcelJS generates formatted document with all styling → Downloads file with sequential numbering → Saves to delivery notes history
- **Success criteria**: 
  - **Szállító Export** creates a complete delivery note with customer details, product specifications, packaging info, weights, and dates - all formatted in Excel
  - **CMR Export** generates an international transport document with sender, recipient, carrier, and shipment details with professional table formatting
  - Files automatically named with sequential number and customer name
  - Export history saved with full metadata for future reference and reprinting
  - All formatting (borders, fonts, alignment, merged cells) applied programmatically via ExcelJS
  - No template files needed - complete document generation in code

### ExcelJS Document Editor
- **Functionality**: Visual editor for customizing ExcelJS-generated documents with live code preview and export
- **Purpose**: Allow technical users to modify document layouts and field mappings without changing source code
- **Trigger**: User navigates to "ExcelJS Szerkesztő" in Dokumentumok dropdown menu
- **Progression**: Open editor → View/edit ExcelJS code → Preview changes → Test with selected orders → Save modifications
- **Success criteria**: Editor displays current ExcelJS code, allows modifications, provides syntax highlighting, enables testing with real order data

### Order Summary Footer
- **Functionality**: Fixed footer displaying aggregate metrics for selected or filtered orders
- **Purpose**: Provide at-a-glance totals for key production metrics to aid planning and capacity decisions
- **Trigger**: Automatically displays when viewing Orders tab, updates when selection or filters change
- **Progression**: View orders list → Summary footer shows totals → Select orders to see selected totals → Clear selection to see filtered totals
- **Success criteria**: Footer shows count, total pieces, boxes, pallets, gross weight, required material, and production hours; clearly indicates if showing selected vs filtered orders; remains fixed at bottom of viewport

### Backup & Restore (Import/Export)
- **Functionality**: Complete data backup and restore system for all application data including orders, customers, products, delivery notes, CMR settings, and customer sequences
- **Purpose**: Enable users to safely backup all data to JSON files, restore from previous backups, and migrate data between systems
- **Trigger**: User navigates to "Mentések" (Saves) tab from Dokumentumok dropdown menu
- **Progression**: 
  - **Export**: Click "Biztonsági mentés létrehozása" → System packages all data into JSON → Downloads file to computer → Saves backup metadata in system
  - **Import**: Click "Importálás fájlból" → Select JSON backup file → Review confirmation dialog with data counts → Confirm restoration → All data replaced with backup
  - **Saved Backups**: View saved backup list → Click restore icon → Confirm → Data restored from saved backup
  - **Download Saved**: Click download icon on saved backup → JSON file downloads to computer
- **Success criteria**: 
  - Backups include all data types (orders, customers, products, delivery notes, settings)
  - Backup files are valid JSON and can be opened/edited externally
  - Import validates file format and shows clear error messages for invalid files
  - Restore operations show confirmation dialogs with data counts before overwriting
  - Saved backups persist in system and can be restored or downloaded anytime
  - File naming follows consistent pattern: `produktivpro-backup-YYYY-MM-DD-HHmm.json`
  - UI displays current data counts (orders, customers, products) before backup
  - Backup list shows detailed metadata: timestamp, record counts, file size
  - Toast notifications confirm successful operations and show relevant statistics

## Edge Case Handling

- **Empty States**: Friendly onboarding messages when no work orders exist, guiding users to create their first order
- **Invalid Quantities**: Prevent negative values or non-numeric inputs in quantity fields with inline validation
- **Overlapping Resources**: Warn users when attempting to assign already-allocated resources with visual indicators
- **Incomplete Orders**: Allow saving draft work orders with missing optional fields, clearly marking them as incomplete
- **Data Recovery**: Use persistent storage to ensure no data loss on refresh or accidental navigation
- **Long Lists**: Implement search and filtering for work orders and resources when lists grow beyond 20 items
- **Date Conflicts**: Highlight orders with past-due dates and allow priority re-ordering
- **Bulk Import Errors**: Validate Excel data row-by-row, show specific errors with row numbers, allow partial imports
- **Invalid File Formats**: Reject non-Excel files with clear error messages, guide users to correct format
- **Duplicate Customer Data**: Handle duplicate entries gracefully during bulk import with warnings

## Design Direction

The design should evoke industrial efficiency, precision, and reliability - conveying the feeling of a well-oiled manufacturing operation. Visual elements should emphasize hierarchy, status clarity, and data density without overwhelming users. The aesthetic should balance professional utility with modern digital craftsmanship, using bold accent colors for status indicators and maintaining clear information architecture throughout.

## Color Selection

An industrial-tech palette that balances authority with energy, using deep blues for stability and vibrant accent colors for status differentiation.

- **Primary Color**: Deep Industrial Blue `oklch(0.35 0.08 250)` - Conveys reliability, technical precision, and manufacturing authority
- **Secondary Colors**: 
  - Slate Gray `oklch(0.50 0.02 250)` - Supporting backgrounds and secondary UI elements
  - Steel Blue `oklch(0.65 0.06 250)` - Muted interactive elements and borders
- **Accent Color**: Electric Orange `oklch(0.68 0.18 45)` - High-priority alerts, active production status, and critical CTAs
- **Status Colors**:
  - Success Green `oklch(0.65 0.15 145)` - Completed orders, quality pass
  - Warning Amber `oklch(0.75 0.15 75)` - In-progress, attention needed
  - Error Red `oklch(0.60 0.22 25)` - Failed quality, overdue, stopped production
- **Foreground/Background Pairings**: 
  - Primary (Deep Industrial Blue `oklch(0.35 0.08 250)`): White text `oklch(0.98 0 0)` - Ratio 8.2:1 ✓
  - Accent (Electric Orange `oklch(0.68 0.18 45)`): Dark text `oklch(0.20 0.02 250)` - Ratio 7.1:1 ✓
  - Background (Light `oklch(0.97 0.005 250)`): Dark text `oklch(0.25 0.02 250)` - Ratio 12.5:1 ✓
  - Success Green: White text `oklch(0.98 0 0)` - Ratio 5.2:1 ✓
  - Muted (Slate `oklch(0.50 0.02 250)`): White text `oklch(0.98 0 0)` - Ratio 4.8:1 ✓

## Font Selection

Typography should convey technical precision while maintaining excellent readability for data-dense interfaces and quick scanning in production environments.

- **Primary Font**: **IBM Plex Sans** - A technical yet humanist sans-serif that balances precision with approachability, ideal for manufacturing applications
- **Monospace Font**: **JetBrains Mono** - For numerical data, quantities, timestamps, and order IDs requiring precise alignment

- **Typographic Hierarchy**: 
  - H1 (Page Titles): IBM Plex Sans Bold / 32px / tight tracking (-0.02em)
  - H2 (Section Headers): IBM Plex Sans SemiBold / 24px / tight tracking (-0.01em)
  - H3 (Card Titles): IBM Plex Sans Medium / 18px / normal tracking
  - Body (Main Text): IBM Plex Sans Regular / 15px / relaxed leading (1.6)
  - Data (Numbers/IDs): JetBrains Mono Medium / 14px / tabular figures enabled
  - Labels: IBM Plex Sans Medium / 13px / uppercase / wide tracking (0.05em)
  - Small (Metadata): IBM Plex Sans Regular / 13px / muted color

## Animations

Animations should reinforce status changes and data updates while maintaining the snappy responsiveness expected in production environments. Use purposeful motion to guide attention to critical updates without slowing down operator workflows.

- **Status Transitions**: Smooth 200ms color fades when work orders change state (planned → in-progress → complete)
- **Data Updates**: Subtle pulse effect (300ms) when production quantities increment or metrics refresh
- **Modal Entry**: Clean slide-up with backdrop blur (250ms) for work order creation/editing dialogs
- **List Interactions**: Quick hover lift (100ms) on cards to reinforce interactivity without delay
- **Progress Bars**: Animated fill with easing (400ms) when progress updates to celebrate momentum
- **Page Transitions**: Instant tab switching with subtle content fade-in (150ms) for responsive feel

## Component Selection

- **Components**: 
  - **Card**: Primary container for work orders, resource items, and metric displays with hover states
  - **Dialog**: Work order creation/editing forms with overlay for focused data entry
  - **Tabs**: Main navigation between Dashboard, Work Orders, Resources, and Analytics views
  - **Button**: Multiple variants (default for secondary actions, primary for creation, destructive for deletion)
  - **Badge**: Status indicators with color coding (planned/in-progress/complete/paused)
  - **Progress**: Visual representation of production completion percentage
  - **Table**: Resource allocation and detailed work order lists with sorting
  - **Select**: Dropdowns for priority levels, product selection, resource assignment
  - **Input**: Form fields with clear labels for quantities, dates, and text entry
  - **Textarea**: Notes and comments fields for quality issues and order details
  - **Separator**: Visual division between card sections and dashboard metrics
  - **Alert**: Critical notifications for resource conflicts or quality issues
  - **Tooltip**: Contextual help for status icons and abbreviated information

- **Customizations**: 
  - **Status Cards**: Custom work order cards with left-border accent color indicating priority/status
  - **Metric KPI Cards**: Dashboard cards with large numbers, trend indicators, and sparkline charts
  - **Production Timeline**: Custom horizontal progress visualization showing order sequence
  - **Resource Allocation Grid**: Visual grid showing machine/operator availability by time slot

- **States**: 
  - Buttons: Distinct hover with subtle lift and border brightening, active state with pressed effect, disabled state with 50% opacity
  - Cards: Hover shows elevated shadow and slight scale (1.01), selected state has primary border and subtle background tint
  - Inputs: Focus state with primary ring and label color change, error state with red ring and helper text
  - Badges: Pulse animation for "in-progress" status, solid for completed, muted for planned

- **Icon Selection**: 
  - Factory (production icon), Plus (new work order), Play/Pause (production control)
  - CheckCircle (completed), Warning (quality issues), Clock (pending/scheduled)
  - Users (operators), Wrench (machines), Package (materials)
  - ChartBar (analytics), Funnel (filters), Calendar (scheduling)

- **Spacing**: 
  - Card padding: `p-6` for content density with breathing room
  - Section gaps: `gap-6` between cards, `gap-8` between major sections
  - Form fields: `gap-4` in vertical stacks, `space-y-2` for label-input pairs
  - Dashboard grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6` for responsive KPIs
  - List items: `space-y-3` for comfortable scanning

- **Mobile**: 
  - Tabs convert to bottom sheet navigation on mobile
  - Dashboard KPIs stack vertically with full-width cards
  - Work order cards show condensed info with expandable detail drawer
  - Forms use full-screen dialog on mobile for easier input
  - Tables switch to card-based layout with key information prioritized
  - Action buttons become floating action button (FAB) for primary creation action
