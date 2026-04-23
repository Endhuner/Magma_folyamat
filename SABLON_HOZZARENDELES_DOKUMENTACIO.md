# Sablon Hozzárendelési Rendszer - Átfogó Dokumentáció

## 📋 Tartalomjegyzék

1. [Áttekintés](#áttekintés)
2. [Sablon Típusok](#sablon-típusok)
3. [Vevő-specifikus Sablonok](#vevő-specifikus-sablonok)
4. [Sablon Prioritási Rend](#sablon-prioritási-rend)
5. [Használati Útmutató](#használati-útmutató)
6. [Műszaki Implementáció](#műszaki-implementáció)
7. [Példák és Használati Esetek](#példák-és-használati-esetek)
8. [Hibaelhárítás](#hibaelhárítás)

---

## 🎯 Áttekintés

A ProduktívPro rendszer lehetővé teszi, hogy minden vevőhöz egyedi dokumentum sablonokat rendeljen hozzá. Ez biztosítja, hogy minden vevő a számára testreszabott dokumentumokat kapja, automatikusan, emberi beavatkozás nélkül.

### Főbb Jellemzők

- **Automatikus sablonválasztás**: A rendszer automatikusan kiválasztja a megfelelő sablont a vevő alapján
- **Vevő-specifikus testreszabás**: Minden vevőhöz külön sablon rendelhető
- **Alapértelmezett sablonok**: Ha nincs vevő-specifikus sablon, az alapértelmezett kerül használatra
- **Három sablon típus támogatása**: Szállítólevél, CMR, és Címke sablonok

---

## 📄 Sablon Típusok

### 1. Szállítólevél Sablon (Delivery Template)

**Célja**: Szállítólevelek generálása HTML formátumban

**Főbb tulajdonságok**:
- A4-es álló formátum
- Vevő és termékinformációk megjelenítése
- Összesítő információk (mennyiség, dobozok, raklapok, súly)
- Aláírási mezők

**Használható változók**:
```
{{sequenceNumber}}        - Szállítólevél sorszáma
{{customerName}}          - Vevő neve
{{customerAddress}}       - Vevő címe
{{customerCity}}          - Vevő városa
{{customerCountry}}       - Vevő országa
{{customerTaxNumber}}     - Vevő adószáma
{{currentDate}}           - Mai dátum
{{totalQuantity}}         - Összes mennyiség (db)
{{totalBoxes}}            - Összes doboz
{{totalPallets}}          - Összes raklap
{{totalGrossWeight}}      - Összes bruttó súly (kg)
{{items}}                 - Termékek listája (tömb)
  ├─ {{productName}}      - Termék neve
  ├─ {{ownOrderNumber}}   - Vevő rendelési száma
  ├─ {{quantity}}         - Mennyiség
  ├─ {{boxesCount}}       - Dobozok száma
  ├─ {{palletsCount}}     - Raklapok száma
  └─ {{grossWeight}}      - Bruttó súly
```

### 2. CMR Sablon (International Consignment Note)

**Célja**: Nemzetközi fuvarlevél dokumentumok generálása

**Főbb tulajdonságok**:
- A4-es formátum
- Nemzetközi szabványnak megfelelő mezők
- Feladó és átvevő információk
- Fuvarozói adatok
- Termékek részletes listája

**Használható változók**:
```
{{sequenceNumber}}        - CMR sorszáma
{{senderName}}            - Feladó neve
{{senderAddress}}         - Feladó címe
{{senderCity}}            - Feladó városa
{{senderCountry}}         - Feladó országa
{{senderTaxNumber}}       - Feladó adószáma
{{customerName}}          - Átvevő neve
{{customerAddress}}       - Átvevő címe
{{customerCity}}          - Átvevő városa
{{customerCountry}}       - Átvevő országa
{{customerTaxNumber}}     - Átvevő adószáma
{{pickupLocation}}        - Átvétel helye
{{issueDate}}             - Kiállítás dátuma
{{carrierName}}           - Fuvarozó neve
{{carrierAddress}}        - Fuvarozó címe
{{vehiclePlate}}          - Jármű rendszáma
{{items}}                 - Termékek listája
  ├─ {{index}}            - Sorszám
  ├─ {{ownOrderNumber}}   - Vevő rendelési száma
  ├─ {{quantity}}         - Darabszám
  ├─ {{packaging}}        - Csomagolás
  ├─ {{productName}}      - Áru megnevezése
  ├─ {{designation}}      - Megnevezés (részletes)
  └─ {{weight}}           - Bruttó súly (kg)
```

### 3. Címke Sablon (Label Template)

**Célja**: Termék címkék generálása nyomtatásra

**Főbb tulajdonságok**:
- A4-es lap 40 címkével (5×8 elrendezés)
- Címke méret: 52.5×29.7 mm
- Automatikus oldalkitöltés (mindig 40-el osztható címkeszám)
- Többszörös példány támogatás

**Használható változók**:
```
{{productName}}           - Termék neve
{{ownOrderNumber}}        - Vevő rendelési száma
{{requiredDate}}          - Szállítási határidő
{{drawingNumber}}         - Rajzszám
{{piecesPerBox}}          - Doboz/db mennyiség
{{customerName}}          - Vevő neve
```

**Testreszabási lehetőségek**:
- Margók beállítása (mm)
- Címkék száma oldalanként
- Elrendezés (sorok × oszlopok)
- Betűtípus beállítások
- Szegély és kitöltés méretezése
- Többszörös példány nyomtatás
- Üres címkék elhagyása

---

## 👥 Vevő-specifikus Sablonok

### Hogyan Működik?

Minden vevőhöz három különböző típusú sablon rendelhető hozzá:
1. **Szállítólevél sablon** (`deliveryTemplateId`)
2. **CMR sablon** (`cmrTemplateId`)
3. **Címke sablon** (`labelTemplateId`)

### Sablonok Hozzárendelése

#### 1. Vevő Szerkesztése

1. Navigálj a **Vevők** fülre
2. Kattints a **Szerkesztés** gombra a kiválasztott vevőnél
3. Görgess le a **"Sablonok hozzárendelése"** szakaszhoz

#### 2. Sablonok Kiválasztása

Három legördülő menü áll rendelkezésre:

```
┌─────────────────────────────────────┐
│ Szállítólevél Sablon                │
├─────────────────────────────────────┤
│ ☐ Alapértelmezett használata         │
│ ☐ Szállítólevél Sablon - 2026.03.13│
│ ☐ Egyedi Vevő X Sablon              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ CMR Sablon                           │
├─────────────────────────────────────┤
│ ☐ Alapértelmezett használata         │
│ ☐ CMR Sablon - 2026.03.13           │
│ ☐ Nemzetközi Vevő CMR                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Címke Sablon                         │
├─────────────────────────────────────┤
│ ☐ Alapértelmezett használata         │
│ ☐ Címke Sablon 1                     │
│ ☐ Vevő X Speciális Címke             │
└─────────────────────────────────────┘
```

#### 3. Mentés

- Kattints a **"Mentés"** gombra
- A rendszer automatikusan elmenti a sablonok hozzárendelését
- A változtatások azonnal érvénybe lépnek

### Automatikus Sablonválasztás

Amikor dokumentumot generálsz (Szállítólevél, CMR vagy Címke), a rendszer a következő logika szerint választ:

```
1. Ellenőrzi: Van-e kiválasztott rendelés?
   ├─ Igen → Folytatás
   └─ Nem → Hibaüzenet

2. Lekéri az első rendelés vevőjét
   └─ customer = orders[0].customer

3. Megkeresi a vevőt az adatbázisban
   └─ customerInfo = customers.find(c => c.name === customer)

4. Ellenőrzi: Van-e vevő-specifikus sablon?
   ├─ deliveryTemplateId/cmrTemplateId/labelTemplateId != null
   │  ├─ Igen → Betölti a vevő-specifikus sablont
   │  └─ Sablon használata a generáláshoz
   └─ Nem → Alapértelmezett sablon használata
```

---

## 🔄 Sablon Prioritási Rend

### Hierarchia

A rendszer a következő prioritási sorrendben választja ki a sablont:

```
┌─────────────────────────────────────────┐
│  1. VEVŐ-SPECIFIKUS SABLON              │  ← LEGMAGASABB PRIORITÁS
│     (Customer.deliveryTemplateId)        │
├─────────────────────────────────────────┤
│  2. ALAPÉRTELMEZETT RENDSZER SABLON     │
│     (Beépített sablon)                   │
└─────────────────────────────────────────┘
```

### Döntési Folyamat Példa

**Szállítólevél generálásnál**:

```typescript
// 1. Lépés: Vevő azonosítása
const firstOrder = selectedOrders[0]
const customer = customers.find(c => c.name === firstOrder.customer)

// 2. Lépés: Sablon keresése
let templateToUse = null

if (customer?.deliveryTemplateId) {
  // Van vevő-specifikus sablon
  const savedTemplates = await spark.kv.get('saved-templates')
  templateToUse = savedTemplates?.find(t => 
    t.data.id === customer.deliveryTemplateId && 
    t.data.type === 'delivery'
  )
  
  console.log('✅ Vevő-specifikus sablon használata:', templateToUse.name)
}

if (!templateToUse) {
  // Nincs vevő-specifikus sablon, alapértelmezett használata
  console.log('ℹ️ Alapértelmezett sablon használata')
  // ... alapértelmezett sablon betöltése
}

// 3. Lépés: Dokumentum generálása a kiválasztott sablonnal
```

---

## 📖 Használati Útmutató

### Új Vevő-specifikus Sablon Létrehozása

#### 1. lépés: Sablon Készítése

1. Navigálj a **Dokumentumok** → **Sablon Szerkesztő** menübe
2. Kattints az **"Új Sablon"** gombra
3. Válaszd ki a sablon típusát:
   - Szállítólevél (`delivery`)
   - CMR (`cmr`)
   - Címke (`label`)

#### 2. lépés: Sablon Testreszabása

**Szállítólevél/CMR sablonnál**:
```html
<!-- HTML szerkesztő használata -->
<div class="header">
  <h1>{{customerName}} Szállítólevele</h1>
  <p>Sorszám: {{sequenceNumber}}</p>
</div>

<table>
  <thead>
    <tr>
      <th>Termék</th>
      <th>Vevő rendelés</th>
      <th>Mennyiség</th>
    </tr>
  </thead>
  <tbody>
    {{#items}}
    <tr>
      <td>{{productName}}</td>
      <td>{{ownOrderNumber}}</td>
      <td>{{quantity}} db</td>
    </tr>
    {{/items}}
  </tbody>
</table>
```

**Címke sablonnál**:
- Állítsd be a margókat (felső, jobb, alsó, bal)
- Válaszd meg a címkék számát oldalanként
- Testreszabd a betűtípust és méreteket
- Állítsd be a szegély vastagságát és színét

#### 3. lépés: Sablon Mentése

1. Adj nevet a sablonnak (pl. "Vevő X Egyedi Szállítólevél")
2. Adj hozzá leírást (opcionális)
3. Kattints a **"Mentés"** gombra
4. A sablon megjelenik a **Sablon Mentések** listában

#### 4. lépés: Sablon Hozzárendelése Vevőhöz

1. Menj a **Vevők** fülre
2. Szerkeszd a kívánt vevőt
3. A **"Sablonok hozzárendelése"** részben válaszd ki az új sablont
4. Mentsd el a változtatásokat

### Sablon Tesztelése

#### Előnézet Funkció (Címkéknél)

1. Menj a **Rendelések** fülre
2. Jelölj ki egy vagy több rendelést a vevőtől
3. Kattints a **"Dokumentáció készítés"** → **"Előnézet megnyitása"** gombra
4. Ellenőrizd az előnézetet új ablakban
5. Ha minden rendben, generálhatod az éles dokumentumot

#### Éles Generálás

1. Jelölj ki rendeléseket
2. Kattints a megfelelő generáló gombra:
   - **Szállító (HTML)** - Szállítólevél
   - **CMR (HTML)** - CMR dokumentum
   - **Címkék generálása** - Címkék
3. A dokumentum automatikusan letöltésre kerül
4. Ellenőrizd, hogy a megfelelő sablon került-e használatra

---

## 🔧 Műszaki Implementáció

### Adatstruktúra

#### Customer Interface
```typescript
export interface Customer {
  id: string
  name: string
  language: string
  city: string
  postalCode: string
  street: string
  country: string
  fullAddress: string
  taxNumber: string
  
  // Sablon hozzárendelések
  deliveryTemplateId?: string | null
  cmrTemplateId?: string | null
  labelTemplateId?: string | null
  
  createdAt: string
  updatedAt: string
}
```

#### Template Storage
```typescript
// Sablon tárolás KV store-ban
interface SavedTemplate {
  id: string
  name: string
  type: 'delivery' | 'cmr'
  timestamp: string
  size: number
  data: {
    id: string
    name: string
    type: 'delivery' | 'cmr'
    html: string
    css: string
    timestamp: string
    description?: string
    margins: {
      top: string
      right: string
      bottom: string
      left: string
    }
  }
}

// Label Template külön interfész
interface LabelTemplate {
  id: string
  name: string
  type: 'label'
  html: string
  css: string
  timestamp: string
  description?: string
  margins: { top: string; right: string; bottom: string; left: string }
  labelsPerPage?: number
  labelsPerRow?: number
  labelsPerColumn?: number
  cellSettings?: {
    width?: string
    height?: string
    borderWidth?: string
    borderColor?: string
    padding?: string
    fontSize?: string
  }
  fontSettings?: {
    fontFamily?: string
    productFontSize?: string
    productFontWeight?: string
    productColor?: string
    orderFontSize?: string
    orderColor?: string
    dateFontSize?: string
    dateColor?: string
  }
}
```

### Kulcs Funkciók

#### 1. Szállítólevél Exportálás

**Fájl**: `src/lib/deliveryHtmlTemplate.ts`

```typescript
export async function exportDeliveryAsHtml(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onSave: (deliveryNote: Partial<DeliveryNote>, sequenceNumber: string) => void,
  customStyles?: Partial<TemplateStyles>
) {
  const firstOrder = orders[0]
  const customer = customers.find(c => c.name === firstOrder?.customer)
  
  let templateToUse = null
  
  // 1. Vevő-specifikus sablon keresése
  if (customer?.deliveryTemplateId) {
    try {
      const savedTemplates = await spark.kv.get<any[]>('saved-templates')
      const template = savedTemplates?.find(t => 
        t.data.id === customer.deliveryTemplateId && 
        t.data.type === 'delivery'
      )
      
      if (template) {
        templateToUse = template.data
        console.log('=== Szállítólevél Export Vevő-Specifikus Sablonnal ===')
        console.log('Vevő neve:', customer.name)
        console.log('Sablon neve:', templateToUse.name)
      }
    } catch (error) {
      console.warn('Nem sikerült betölteni a vevő sablonját', error)
    }
  }
  
  // 2. HTML generálás
  const html = templateToUse
    ? generateFromCustomTemplate(orders, customers, products, deliveryNotes, templateToUse)
    : generateDeliveryHtmlTemplate(orders, customers, products, deliveryNotes, customStyles)
  
  // 3. Fájl letöltése
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `szallitolevel_${sequenceNumber}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
```

#### 2. CMR Exportálás

**Fájl**: `src/lib/cmrHtmlTemplate.ts`

```typescript
export async function exportCmrAsHtml(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  deliveryNotes: DeliveryNote[],
  onSave: (deliveryNote: Partial<DeliveryNote>, sequenceNumber: string) => void,
  settings?: CmrLayoutSettings
) {
  const firstOrder = orders[0]
  const customer = customers.find(c => c.name === firstOrder?.customer)
  
  let templateToUse = null
  
  // 1. Vevő-specifikus CMR sablon keresése
  if (customer?.cmrTemplateId) {
    try {
      const savedTemplates = await spark.kv.get<any[]>('saved-templates')
      const template = savedTemplates?.find(t => 
        t.data.id === customer.cmrTemplateId && 
        t.data.type === 'cmr'
      )
      
      if (template) {
        templateToUse = template.data
        console.log('=== CMR Export Vevő-Specifikus Sablonnal ===')
        console.log('Vevő neve:', customer.name)
        console.log('Sablon neve:', templateToUse.name)
      }
    } catch (error) {
      console.warn('Nem sikerült betölteni a vevő CMR sablonját', error)
    }
  }
  
  // 2. Sablon feldolgozás és változók helyettesítése
  const html = templateToUse
    ? processCustomCmrTemplate(templateToUse, orders, customers, products, deliveryNotes, settings)
    : generateCmrHtmlTemplate(orders, customers, products, deliveryNotes, settings)
  
  // 3. Letöltés
  // ...
}
```

#### 3. Címke Generálás

**Fájl**: `src/lib/labelTemplate.ts`

```typescript
export async function generateLabels(
  orders: Order[],
  customers: Customer[],
  products: Product[],
  customTemplate?: LabelTemplate
) {
  let templateToUse = customTemplate
  
  // 1. Ha nincs kézzel kiválasztott sablon, keressük a vevő-specifikus sablont
  if (!templateToUse) {
    const firstOrder = orders[0]
    const customer = customers.find(c => c.name === firstOrder?.customer)
    
    if (customer?.labelTemplateId) {
      try {
        const labelTemplates = await spark.kv.get<LabelTemplate[]>('label-templates')
        templateToUse = labelTemplates?.find(t => t.id === customer.labelTemplateId)
        
        if (templateToUse) {
          console.log('=== Címke Export Vevő-Specifikus Sablonnal ===')
          console.log('Vevő neve:', customer.name)
          console.log('Sablon neve:', templateToUse.name)
        }
      } catch (error) {
        console.warn('Nem sikerült betölteni a vevő címke sablonját', error)
      }
    }
  }
  
  // 2. Címke adatok előkészítése
  const labels = prepareLabels(orders, customers, products)
  
  // 3. HTML generálás
  const html = templateToUse 
    ? generateCustomLabelHTML(labels, templateToUse)
    : generateLabelHTML(labels)
  
  // 4. Letöltés
  // ...
}
```

### Perzisztencia

#### KV Store Kulcsok

```typescript
// Vevők tárolása
'customers' → Customer[]

// Mentett sablonok (Szállítólevél, CMR)
'saved-templates' → SavedTemplate[]

// Címke sablonok
'label-templates' → LabelTemplate[]

// Aktív címke sablon
'active-label-template' → string | null
```

#### Mentés és Betöltés

```typescript
// Vevő mentése sablonokkal
const saveCustomer = (customerData: Partial<Customer>) => {
  setCustomers((current) => {
    if (existingCustomer) {
      return current.map(c => 
        c.id === existingCustomer.id 
          ? { ...c, ...customerData, updatedAt: new Date().toISOString() }
          : c
      )
    } else {
      return [...current, {
        ...customerData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]
    }
  })
}

// Sablon betöltése
const loadTemplate = async (templateId: string, type: 'delivery' | 'cmr') => {
  const savedTemplates = await spark.kv.get<SavedTemplate[]>('saved-templates')
  return savedTemplates?.find(t => 
    t.data.id === templateId && 
    t.data.type === type
  )
}
```

---

## 💡 Példák és Használati Esetek

### Használati Eset 1: Nemzetközi Vevő Speciális CMR-rel

**Forgatókönyv**: 
Egy német vevő, aki csak németül fogadja el a CMR dokumentumokat, speciális formázással.

**Megoldás**:

1. **CMR Sablon Létrehozása**:
   - Menj a Sablon Szerkesztőbe
   - Hozz létre új CMR sablont "Német Vevő CMR" néven
   - Fordítsd le a mezőneveket németre
   - Állítsd be a vevő preferált betűtípusát

2. **Vevő Beállítása**:
   ```
   Vevő neve: Deutsche Firma GmbH
   CMR Sablon: Német Vevő CMR
   ```

3. **Automatikus Használat**:
   - Amikor rendelést választasz ki a Deutsche Firma GmbH vevőhöz
   - És CMR-t generálsz
   - Automatikusan a "Német Vevő CMR" sablon kerül használatra

### Használati Eset 2: Több Vevő Ugyanazzal a Sablonnal

**Forgatókönyv**:
5 vevőd van, akik ugyanazt a speciális címke formátumot kérik.

**Megoldás**:

1. **Egy Címke Sablon Létrehozása**:
   - Hozz létre egy "Prémium Vevők Címke" sablont
   - Állítsd be a közös formázást

2. **Sablon Hozzárendelése Minden Vevőhöz**:
   ```
   Vevő 1: Címke Sablon = "Prémium Vevők Címke"
   Vevő 2: Címke Sablon = "Prémium Vevők Címke"
   Vevő 3: Címke Sablon = "Prémium Vevők Címke"
   Vevő 4: Címke Sablon = "Prémium Vevők Címke"
   Vevő 5: Címke Sablon = "Prémium Vevők Címke"
   ```

3. **Központi Frissítés**:
   - Ha a sablont módosítod, mind az 5 vevőnél automatikusan frissül

### Használati Eset 3: Vevő Átmeneti Alapértelmezettre Váltása

**Forgatókönyv**:
Egy vevő ideiglenesen az alapértelmezett sablont akarja használni.

**Megoldás**:

1. **Vevő Szerkesztése**:
   - Menj a Vevők fülre
   - Szerkeszd a vevőt

2. **Sablon Visszaállítása**:
   ```
   Szállítólevél Sablon: "Alapértelmezett használata"
   ```

3. **Későbbi Visszaállítás**:
   - Ugyanígy állíthatod vissza a speciális sablonra

### Használati Eset 4: Sablon Tesztelése Éles Használat Előtt

**Forgatókönyv**:
Új sablont készítettél, és ellenőrizni akarod, mielőtt hozzárendeled a vevőhöz.

**Megoldás**:

1. **Előnézet Funkció** (Címkéknél):
   ```
   Rendelések → Kijelölés → Dokumentáció készítés 
   → Előnézet megnyitása
   ```

2. **Teszt Generálás**:
   - Generálj egy dokumentumot alapértelmezett sablonnal
   - Szerkeszd a vevőt, rendelj hozzá új sablont
   - Generálj újra ugyanazokkal a rendelésekkel
   - Hasonlítsd össze a két verziót

3. **Visszavonás ha Szükséges**:
   - Ha nem megfelelő, állítsd vissza alapértelmezettre
   - Módosítsd a sablont
   - Ismételd a tesztet

---

## 🔍 Hibaelhárítás

### Probléma 1: A Vevő-specifikus Sablon Nem Kerül Használatra

**Tünetek**:
- Kiválasztottad a sablont a vevőnél
- De alapértelmezett sablon kerül használatra

**Ellenőrzési Lépések**:

1. **Console Log Ellenőrzése**:
   ```
   Nyisd meg a böngésző Developer Tools-t (F12)
   Console fülön nézd meg:
   - "=== Szállítólevél Export Vevő-Specifikus Sablonnal ==="
   - vagy csak: "ℹ️ Alapértelmezett sablon használata"
   ```

2. **Vevő Azonosítás Ellenőrzése**:
   - A kiválasztott rendelések vevője egyezik-e a vevő nevével?
   - Elírás lehet a névben?

3. **Sablon ID Ellenőrzése**:
   ```typescript
   // Developer Console-ban futtasd:
   spark.kv.get('customers').then(customers => {
     const customer = customers.find(c => c.name === 'VEVŐ_NEVE')
     console.log('Customer template IDs:', {
       delivery: customer?.deliveryTemplateId,
       cmr: customer?.cmrTemplateId,
       label: customer?.labelTemplateId
     })
   })
   
   spark.kv.get('saved-templates').then(templates => {
     console.log('Available templates:', templates.map(t => ({
       id: t.data.id,
       name: t.data.name,
       type: t.data.type
     })))
   })
   ```

4. **Sablon Típus Egyezés**:
   - Delivery template ID-t delivery típusú sablonhoz rendeltél?
   - CMR template ID-t CMR típusú sablonhoz?

**Megoldás**:
```
1. Ellenőrizd, hogy a sablon létezik a "Sablon Mentések"-ben
2. Másold ki a sablon ID-ját
3. Szerkeszd a vevőt
4. Válaszd ki újra a sablont
5. Mentsd el
6. Próbáld újra a generálást
```

### Probléma 2: Sablon Változók Nem Jelennek Meg

**Tünetek**:
- A generált dokumentumban `{{customerName}}` látszik változó helyett

**Ok**:
- A változó név helytelenül van írva
- Vagy a változó nem létezik

**Megoldás**:

1. **Használható Változók Ellenőrzése**:
   - Nézd meg a "Használható változók" listát a Sablon Szerkesztőben
   - Másold ki pontosan onnan a változó nevet

2. **Gyakori Elírások**:
   ```
   ❌ {{customername}}     (kisbetű)
   ✅ {{customerName}}     (camelCase)
   
   ❌ {{customer_name}}    (alulvonás)
   ✅ {{customerName}}     (camelCase)
   
   ❌ {{ customerName }}   (szóközök)
   ✅ {{customerName}}     (szóköz nélkül)
   ```

3. **Tömb Iteráció**:
   ```html
   <!-- Helyes: -->
   {{#items}}
     <tr>
       <td>{{productName}}</td>
       <td>{{ownOrderNumber}}</td>
     </tr>
   {{/items}}
   
   <!-- Helytelen: -->
   {{#items}}
     <tr>
       <td>{{items.productName}}</td>  <!-- ❌ 'items.' prefix -->
       <td>{{items[0].ownOrderNumber}}</td>  <!-- ❌ indexelés -->
     </tr>
   {{/items}}
   ```

### Probléma 3: Címkék Nem Töltik Ki a Teljes Oldalt

**Tünetek**:
- A címkék nem pontosan 40-el osztható számban vannak
- Üres helyek maradnak az oldalon

**Ok**:
- A címke generálás automatikus kitöltése nem működik

**Megoldás**:
```typescript
// Ez automatikusan működik a kódban:
const targetLabelCount = Math.ceil(labels.length / 40) * 40

while (labels.length < targetLabelCount) {
  labels.push({
    productName: '',
    ownOrderNumber: '',
    requiredDate: '',
    drawingNumber: '',
    piecesPerBox: '',
    customerName: ''
  })
}
```

Ha mégis probléma van:
1. Ellenőrizd a böngésző console-t hibákért
2. Nézd meg, hogy `labelsPerPage` értéke 40-e a sablonban
3. Ha módosítottad, állítsd vissza 40-re

### Probléma 4: Sablon Nem Jelenik Meg a Legördülő Menüben

**Tünetek**:
- Létrehoztál egy sablont
- De nem látható a vevő szerkesztésénél

**Ellenőrzés**:

1. **Sablon Mentések Ellenőrzése**:
   - Menj a "Sablon Mentések" fülre
   - Látható ott a sablon?
   - Mi a típusa? (delivery/cmr)

2. **Típus Megfeleltetés**:
   ```
   Szállítólevél Sablon legördülő → csak 'delivery' típusú sablonokat mutat
   CMR Sablon legördülő → csak 'cmr' típusú sablonokat mutat
   Címke Sablon legördülő → 'label-templates' KV store-ból tölt
   ```

3. **Developer Console Ellenőrzés**:
   ```javascript
   // Szállítólevél/CMR sablonok
   spark.kv.get('saved-templates').then(templates => {
     console.log('Delivery templates:', 
       templates?.filter(t => t.data.type === 'delivery')
     )
     console.log('CMR templates:', 
       templates?.filter(t => t.data.type === 'cmr')
     )
   })
   
   // Címke sablonok
   spark.kv.get('label-templates').then(templates => {
     console.log('Label templates:', templates)
   })
   ```

**Megoldás**:
- Ha a sablon rossz típussal lett létrehozva, töröldheted és újra létrehozhatod
- Vagy módosíthatod a típust a Developer Console-ban (haladó)

---

## 📚 További Információk

### Kapcsolódó Dokumentációk

- **Sablon Szerkesztő Útmutató**: Hogyan hozz létre és módosíts sablonokat
- **Változók Referencia**: Az összes elérhető változó részletes leírása
- **CMR Szabvány**: A CMR dokumentum nemzetközi követelményei
- **Címke Specifikáció**: A címkék méretezése és formázása

### Gyakran Ismételt Kérdések (GYIK)

**K: Hány vevő-specifikus sablon lehet?**
V: Nincs korlátozás. Minden vevőhöz létrehozhatsz egyedi sablonokat.

**K: Mi történik, ha törlök egy sablont, ami vevőhöz van rendelve?**
V: A rendszer automatikusan az alapértelmezett sablont fogja használni.

**K: Lehet-e több vevőhöz ugyanazt a sablont használni?**
V: Igen, ugyanazt a sablont több vevőhöz is hozzárendelheted.

**K: Lehet-e vevőnként különböző számú címkét generálni?**
V: A címkék száma a rendelés "Dobozok száma" mezőjétől függ. Minden vevőnél ez eltérő lehet.

**K: Hogyan exportálhatom a sablonokat?**
V: A Sablon Mentések menüben minden sablonnál van "Exportálás" gomb.

**K: Importálhatom más rendszerből a sablonokat?**
V: Igen, JSON formátumban importálhatod a sablonokat az "Importálás" gombbal.

---

## 📞 Támogatás

Ha további kérdésed van a sablon hozzárendelési rendszerrel kapcsolatban:

1. Nézd meg a vonatkozó kódfájlokat a `src/lib/` mappában
2. Ellenőrizd a browser console-t hibakeresési információkért
3. Használd a rendszerben beépített előnézet funkciókat teszteléshez

---

**Verzió**: 1.0  
**Utolsó frissítés**: 2025  
**Készítette**: ProduktívPro Fejlesztői Csapat
