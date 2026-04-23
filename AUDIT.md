# ProduktívPro – Teljes Audit (2026-04-23)

Termelés Irányítási Rendszer, React 19 + Vite 7 + Tailwind 4 + Radix UI alapon, GitHub Spark template-re építve. Az alábbi jelentés a kódbázis jelenlegi állapotát értékeli a kérés szerint (build/futás, kódminőség, architektúra, UI/UX, biztonság), és prioritizált javaslatokat tesz a további fejlesztésekre.

---

## 0. Gyors számok

| Mérőszám | Érték | Megjegyzés |
|---|---|---|
| TS/TSX sorok összesen (saját) | ~23 755 | `src/` alatt, `ui/` nélkül is nagy |
| `App.tsx` | 2 289 sor, 89 KB | Monolitikus, 1 komponens = egész alkalmazás |
| Komponensek száma (`src/components/`, nem UI) | 37 | Ebből 2 üres stub (`WorkOrderCard`, `WorkOrderDialog`) |
| `useKV` (Spark-függő) hívások | 66 | Elosztva 15 fájl között |
| `@github/spark` hivatkozás | Publikus npm-en **nem érhető el** (403) | Build-blokkoló |
| `console.log` / `console.warn` | 317 | Éles buildből ki kellene tiltani |
| `: any` / `<any>` | 33 | Fokozatosan szűkíthető |
| Template editor komponens | **3 db**, ~4 100 sor | `HtmlTemplateEditor`, `GithubStyleTemplateEditor`, `ExportTemplateEditor` – átfedéssel |
| Teszt | 0 | Semmilyen unit/e2e teszt nincs |

---

## 1. Kritikus, build-/futásblokkoló problémák

Ezek miatt a jelenlegi projekt **nyilvános környezetben nem fordul le**, a `npm install` is elakad.

### 1.1 `@github/spark` nem publikus csomag
- `package.json`-ban `"@github/spark": ">=0.43.1 <1"` szerepel.
- A csomag a GitHub belső / Spark Codespace-hez kötött registry-n él, npm-ről **403 Forbidden** jön.
- Ez blokkolja a `npm install`-t, tehát **sem a `vite build`, sem a `vite dev` nem indul el** egy normál környezetben (pl. a CI/Dockerfile-ban sem).
- Érintett API-k a projektben:
  - `useKV` hook → 66 helyen
  - `spark.kv.get` → 9 helyen (`cmrHtmlTemplate.ts`, `deliveryHtmlTemplate.ts`, `labelTemplate.ts`, `labelExportFormats.ts`)
  - `window.spark.llm` → 2 helyen (`BulkImportDialog`, `ProductBulkImportDialog`) AI-alapú hiányzó mezőkitöltésre
  - `@github/spark/spark-vite-plugin` és `vitePhosphorIconProxyPlugin` Vite pluginok
  - Globális `spark` típus deklaráció a `src/vite-end.d.ts`-ben

### 1.2 `xlsx-template` csak Node.js-ben
- `src/lib/xlsxTemplateExport.ts` a böngészőben explicit kivételt dob:  
  `"Az xlsx-template csak Node.js környezetben működik..."`
- A csomag függőség, de a futási kódágak mind kivételhez vezetnek – lényegében **holt kód**. A valódi exportokat az ExcelJS alapú útvonalak végzik (`cmrDirectExport.ts`, `deliveryExcelJSExport.ts`, `exceljsTemplateExport.ts`).

### 1.3 Két különböző CSS belépési pont
- `index.html` direkten a `/src/main.css`-re hivatkozik.
- `src/main.tsx` viszont `"./main.css"`, `"./styles/theme.css"`, `"./index.css"` hármast importál.
- A két belépési pont együtt duplázza a Tailwind import és a `:root` változók deklarációját (`src/index.css` és `src/main.css` is tartalmazza). Működik, de felesleges méretet és összeakadást okoz.

### 1.4 Két, funkcionálisan beteg stub komponens
- `WorkOrderCard.tsx` és `WorkOrderDialog.tsx` összesen 6 sor, `return null`. Sehol nincsenek használva. Vagy törlendők, vagy implementálandók (pl. munkalapkártya a termelés nézethez).

---

## 2. Architektúra / adatrétegi problémák

### 2.1 Spark KV = localStorage-szerű perzisztencia, de kevert API
A `useKV` egy `useState`-szerű szinkron hook, míg a `spark.kv.get` async. A kódbázis **mindkettőt használja ugyanazokra a kulcsokra**:
- `saved-templates`, `active-templates`, `label-templates` egyszerre érhető el UI-ból (`useKV`) és lib modulokból (`await spark.kv.get`).
- Ez reaktivitási/konzisztencia-problémához vezet: az `cmrHtmlTemplate.ts`-ben olvasott sablon egy beállítási/szerkesztési lépés után még a régi értéket adhatja vissza, amíg a Spark KV szinkronizál.

### 2.2 Üzleti logika és UI a `App.tsx`-ben összefolyik (2 289 sor)
- Minden entitás (`orders`, `customers`, `products`, `inventory`, …) globális állapotkezelése itt van, `useKV` hookokkal.
- A handler-függvények (`handleSaveOrder`, `handleBatchStatusChange`, `handleExportCmr` stb.) mind itt vannak, holott tipikus domain-réteg (`orderService`, `inventoryService`) lenne.
- A default HTML + CSS CMR sablon **közvetlenül be van égetve** a `useEffect`-be (~270 sor template literal a App.tsx-ben, 200–595 sor környékén).
- Nincs router – minden tab `useState('currentTab')`. Nem megosztható URL, nincs böngészős vissza, reload elveszti a navigációs helyet.

### 2.3 Háromszoros sablonkezelő
- `ExportTemplateEditor.tsx` (867 sor)
- `GithubStyleTemplateEditor.tsx` (1 398 sor)
- `HtmlTemplateEditor.tsx` (1 838 sor)  
Mindhárom HTML/CSS alapú sablonszerkesztő, jelentős átfedéssel. A App.tsx két lapot is mutat:
- `github-editor` → `GithubStyleTemplateEditor`
- `template-saves` → `TemplateBackupRestore`  
A `HtmlTemplateEditor` és `ExportTemplateEditor` például már nincs bekötve a fő App-ba, de még 2 700 sor kód. Egy közös, tiszta editorra lehet csökkenteni.

### 2.4 Domain modell zaja
- `Order.invoiced: string` és `ready: string` – valójában boolean jellegű mezők `'x' | 'X' | ''` értékkészlettel. Típus-biztonság elvész, duplikált vizsgálat (`o.invoiced === 'x' || o.invoiced === 'X'`) sok helyen.
- Sok szám mező `string`-ként van (`weightPerPiece`, `cycleTime`, `requiredMaterialKg`, `grossWeightKg` stb.). Minden konverzió `parseNumberLoose`-on megy át; egyetlen ponton elég lenne.
- `Customer`-nek `id` opcionális lehet (`handleSaveCustomer` új vevőnél nem ad id-t!).
- `InventoryTransaction` `createdAt`-ot ad, de `updatedAt`-ot nem – részleges audit trail.

### 2.5 Duplikált utility-k
- `stripDiacritics` és `isDelivered` **4× van megírva**: `lib/helpers.ts`, `App.tsx`, `OrdersTable.tsx`, `OrderDialog.tsx`.
- Meg kell tartani a `lib/helpers.ts` változatot, a többit importra cserélni.

### 2.6 Beégetett adatok
- "Magma Kft", "H-1211 Budapest, Déli utca 13.", "HU10368152-2-43" adószám több ponton hardcoded default:
  - `App.tsx` (cmrSettings defaults)
  - `lib/cmrHtmlTemplate.ts` (DEFAULT_CMR_SETTINGS)
  - `lib/xlsxTemplateExport.ts`
- Ha egy másik cég telepíti, **kézzel kell mindenhol módosítania**. Egy `constants.ts`-be ki kell vinni, vagy a `CmrLayoutSettings`-et kezdeti értékekkel üresen hagyni.

### 2.7 Nincs backend / multi-user
- Minden adat a böngésző localStorage-ában. Egy másik gép már nem látja.
- Nincs felhasználókezelés, szerepkör, audit log.
- A backup/restore JSON fájlcserével megoldott – működik, de minden ember között manuális egyeztetés kell.

---

## 3. Kódminőségi problémák

### 3.1 Monolit App.tsx
2 289 sor, 1 komponens. Nehéz átlátni, Git-merge konfliktus majdnem garantált, linter/TypeScript is lassú.

### 3.2 Sok `: any`
33 előfordulás – legtöbb a `savedTemplates: any[]` és `(window as any).spark` környékén. A Spark kiváltása után ezek 70-80%-a kiválthatja.

### 3.3 Diagnosztikai log zaj
317 `console.log` / `console.warn` marad a bundle-ben. Ellenőrizetlen éles logolás. Pl. `xlsxTemplateExport.ts` minden CMR generáláskor 15-20 sort ír a konzolra – ügyfélnél ez szemét. Ajánlott egy `logger.ts` és `import.meta.env.DEV` alapú kapcsolás, vagy közvetlen eltávolítás.

### 3.4 `useEffect` alapú side-effect inicializálás
A default sablonok létrehozása (`savedTemplates`) minden első renderkor fut. Ha a `savedTemplates` egyszer betöltődött üresen, még ugyanaznap két sablont is beszúr (egy `deliveryTemplateName` és egy `cmrTemplateName`) – kétszer is duplikálódhat, mert `useEffect` dependency-ja maga `[savedTemplates, setSavedTemplates]`, és a setelés után újra fut. Van benne védelem `some(t => t.name === ...)` ellen, de robusztusabb egy migrációs réteg (`schemaVersion` + egyszeri seed).

### 3.5 Kevert import stílus
Abszolút (`@/lib/types`) és relatív (`./ErrorFallback.tsx`, `./main.css`) keverten. Érdemes mindenhol `@/`-re standardizálni az ESLint segítségével.

### 3.6 Formai inkonzisztencia
- Felváltva single- és double-quote, pontosvessző itt-ott. ESLint/Prettier beállítás nem erőltetett.
- Magyar és angol kommentek keverten.
- Változó- és függvénynevek keveréke (pl. `beallitasIdoPerc`, `tervezettIdoOra` vs. `boxesCount`, `grossWeightKg`).

---

## 4. UI/UX problémák

### 4.1 Navigáció sűrű és részben dupla
- 6 fő tab (Áttekintés / Gyártás / Rendelések / Vevők / Termékek / Készlet), plusz egy `Dokumentumok` dropdown ami további **7 belépési pontot** ad (sablonszerkesztő, mentések, címke sablonok, szállítólevelek, dokumentumok, saves, stb.).
- A `Dokumentumok` dropdown alatti `"Szállítási dokumentumok készítése"` menüpont toast-ot ír ki: `"Szállítási dokumentumok - hamarosan"` – élesen működő alkalmazásban nem szép.
- Ugyanaz a komponens (`DeliveryNotesTable`) két külön tabon is megjelenik (`documents` és `deliveries`), szinte ugyanazokkal a propokkal.

### 4.2 A Rendelések oldali gombok túl sokan vannak
Egyetlen sorban: Új rendelés · Tömeges import · Oszlop szűrő · Új szűrő · Szűrő törlése · Szállító (HTML) · CMR (HTML) · Dokumentáció készítés · Undo · Státusz váltása · Kijelölés törlése · Kijelölt szerkesztése · Kijelölt duplikálása · Kijelöltek törlése. 14 különböző akciócsempe torlódik. Kisebb képernyőn taszító. Érdemes toolbar + kontextusos akciócsoportokra bontani (vagy FAB + selection bar).

### 4.3 Alapértelmezett szűrők elrejtenek dolgokat
- `hideDelivered` default `true`, `yearFilterEnabled` default `true` és az aktuális évet szűri. Új felhasználó egy lépéssel **nem érti, miért nincs adat**, ha év nélkül van egy rendelése.
- A `selectedYears` `useEffect`-tel kerül beállításra – short flash-ben üres lista villan.

### 4.4 Undo csak rendeléseknél
Vevőknél, termékeknél, készletben, címke sablonoknál nincs visszavonás. Toast azt mondja "törölve", de nem állítható vissza – adatvesztés-veszély.

### 4.5 Nincs virtualizálás
`OrdersTable`, `CustomersTable`, `ProductsTable` mind teljes DOM-ot rendel – 1 000+ rendelésnél a lapozás és scroll észrevehetően lassul.

### 4.6 Dátumformátum inkonzisztens
- UI-ban `yyyy/MM/dd` (`format(..., 'yyyy/MM/dd')`), a magyar szabvány `yyyy.MM.dd`.
- A CMR sablonban `toLocaleDateString('hu-HU')` jelenik meg, ami `2026. 04. 23.` – keveredik.

### 4.7 Nincs i18n
Minden szöveg magyarul beégetve. Ha német vevőnek kell szállítólevél, a dokumentum angol-magyar kétnyelvű, de az app UI nem. Egy egyszerű `messages.hu.ts` / `messages.en.ts` struktúra nagyban javítaná az újrahasznosíthatóságot.

### 4.8 Akadálymentesség (a11y) hiányok
- `<input type="file">` láthatatlanná téve, csak a gombra kattintva használható.
- Toast üzenetek `sonner`-rel mennek, de `aria-live` szintekre nincs ellenőrzés.
- Sok ikon-gomb `aria-label` nélkül.
- A `DropdownMenu`-ben `disabled` menüpontok "fejlécként" vannak használva (pl. `"Dokumentum készítése"` disabled opciónak álcázva); ez a billentyűzetnavigációnak rossz.

---

## 5. Biztonsági problémák

### 5.1 HTML sablon injekció
A `HtmlTemplateEditor` és a CMR/szállítólevél generátor **közvetlenül stringezi** a vevőadatokat és rendelésadatokat a HTML-be (`${customer.name}`, `${order.productName}` stb.). Ha egy vevő neve, címe vagy termék-megnevezése `<script>` vagy `</style>` karaktereket tartalmaz, az beszúrásra kerül a generált HTML-be.
- `window.open('', '_blank')` + `doc.write(html)` az előnézeteknél: saját originra nyitott ablak, amelybe kontrollálatlan HTML megy – **XSS-re alkalmas**.
- Megoldás: Mustache/Handlebars típusú template engine, alapból escape-el, vagy egy egyszerű `escapeHtml()` wrapper minden placeholder kiírás előtt.

### 5.2 Backup fájl tanúsítás nélkül importálható
A `BackupRestore` egy JSON-t tölt be és feldolgoz. Ha támadó összeállít egy rosszindulatú backup fájlt (pl. proto pollution-gyanús kulcsokkal), és egy ügyfélre ráveszi, hogy importálja, az adat beépül az alkalmazás KV-be. Érdemes legalább schema-validáció (zod – amúgy már dependency!).

### 5.3 AI prompt-injekció
A `BulkImportDialog` és `ProductBulkImportDialog` vevőadatokat ad át a Spark LLM-nek, és a **JSON választ parse-olja**. Ha egy feltöltött Excelben a vevő neve `... } malicious ... {` karaktereket tartalmaz, a prompt feltörhető, a parseolás elromolhat. Ez inkább adatintegritás probléma (garbage in / garbage out), mint exploitálható CVE, de érdemes escape-elni vagy valid JSON-schema-t kötelezni az LLM-től.

### 5.4 Nincs CSP
A `public/` alatt nincs CSP meta tag. A `index.html` tölt külső Google Fontot, de bármilyen inline szkript (XSS) ellen nincs védelem.

---

## 6. Karbantartási / DevOps észrevételek

- **Dockerfile** `npm ci` → ugyanúgy el fog hasalni a `@github/spark` miatt a publikus build környezetben. Meg kell oldani a Spark leválasztását, vagy a build környezetet privát registryvel ellátni.
- **GitHub Actions**: csak `dependabot.yml` van; **nincs CI**, nincs lint/build automata ellenőrzés PR-nél.
- **`.github` és `dependabot`**: a projekt elfogad dependency PR-eket, de nincs teszt, ami elkapja a regressziót.
- **`PRD_RESZLETES.md`** 40 KB – igen részletes, de a kód és a PRD szinkronban van? Javasolt egy sprint folyamán egy "PRD vs. megvalósult" diff-et futtatni.

---

## 7. Prioritizált javaslatlista

### Azonnali (hogy egyáltalán fusson és buildelhető legyen)
1. **Spark-függőség leválasztása**  
   - Saját `useKV(key, defaultValue)` hook localStorage-zel (szinkron, reaktív, JSON-szerializált).  
   - `spark.kv` hívásokat közös `kvStore.get/set/delete/keys` helper-re cserélni, ami ugyanezt a localStorage-t használja.  
   - A két Vite plugint (`sparkPlugin`, `createIconImportProxy`) eltávolítani; a Phosphor ikonokat `@phosphor-icons/react`-ből közvetlenül importálni.  
   - `@github/spark` dependency-t törölni a `package.json`-ból.
2. **AI kitöltés kezelése**  
   Két alternatíva: (a) feature flag mögé rejteni és Anthropic/OpenAI API-kulccsal becserélni; (b) teljesen elhagyni, csak manuális Excel-import marad.
3. **Halott és stub fájlok takarítása**  
   - `xlsxTemplateExport.ts` törlése / megtartása csak ha kiszolgálós CMR-exportot akarsz.  
   - `xlsx-template` dependency törlése.  
   - `WorkOrderCard.tsx`, `WorkOrderDialog.tsx` vagy implementálás, vagy törlés.  
   - Egyetlen Template Editor meghagyása (javaslat: `GithubStyleTemplateEditor`), a másik kettő törlése.

### Rövid távon (kódminőség, UX fájdalompontok)
4. **App.tsx dekompozíciója** – kontextus provider-ek + feature-fájlok szerint (`features/orders`, `features/customers`, `features/inventory`, `features/documents`, `features/labels`).
5. **Router bevezetése** – `react-router` vagy `@tanstack/router`. URL tartalmazza a `tab`-ot, megosztható linkek.
6. **Központi állapotkezelő** – Zustand (kicsi, React 19-kompatibilis) a `useKV`-re rátéve, így reaktív + perzisztens + devtools.
7. **`stripDiacritics`, `isDelivered`, egyéb duplikátumok egyetlen `lib/text.ts`-be**.
8. **Hardcoded cégadatok** egyetlen `lib/constants.ts` + `cmr-layout-settings` KV-be.
9. **Konzisztens dátumformátum** (`dd.MM.yyyy` vagy `yyyy.MM.dd` végig, `date-fns` központi wrapperrel).
10. **`console.log` → saját logger** (`debug/info/warn/error`), `import.meta.env.DEV`-hez kötve.

### Középtávon (UI/UX minőség)
11. **Toolbar refaktor** a Rendelések lapon (akciócsoportok, selection bar).
12. **Virtualizált táblázat** – `@tanstack/react-table` + `@tanstack/react-virtual`, mindhárom táblára.
13. **Globális undo/redo stack**, minden "destruktív" művelet támogatja.
14. **Zod schema minden importnál és backup-restore-nál**. (A `zod` már dep.)
15. **HTML sablon renderelés** Mustache/Handlebars-ra (escape alapból).
16. **Tesztek**: Vitest + React Testing Library a kritikus szolgáltatásokra (`inventoryService`, `orderService`, `helpers`, CMR generátor smoke-test).
17. **i18n** alap (`react-i18next` vagy saját `messages.ts`).
18. **CI** – GitHub Actions: `npm ci && npm run lint && npm run build && npm test`.

### Hosszú távon (ha valódi többfelhasználós rendszer kell)
19. **Backend réteg** – pl. Cloudflare Workers + D1 / Supabase / Pocketbase. Auth + REST/GraphQL API.
20. **Szerveroldali PDF-generálás** – böngészős print helyett Puppeteer.
21. **Audit log + role-based access** (admin / kezelő / olvasó).
22. **Monitoring** – Sentry / LogRocket frontendhez.

---

## 8. Kockázat-összegzés

| Kategória | Érintett | Súly | Sürgős? |
|---|---|---|---|
| Build nem megy | `@github/spark` 403 | Kritikus | Igen |
| Holt kód | `xlsx-template`, stub komponensek | Közepes | Ajánlott |
| Architektúra | 2 289 soros `App.tsx`, 3 sablonszerkesztő | Magas | Igen |
| Adat biztonság | localStorage-only, nincs multi-user | Magas | Üzleti döntés |
| XSS sablonokban | HTML escape hiánya | Magas | Igen, ha külső fél is használja |
| UX | Navigációs sűrűség, undo hiány | Közepes | Ajánlott |
| Tesztek | 0 db | Közepes | Ajánlott |
| Teljesítmény | Tábla-virtualizáció | Közepes | 500+ sor fölött érezhető |

---

## 9. Javasolt következő két feladat

A fenti listából a következő kettő adja a **legnagyobb kockázatcsökkenést** a legkisebb munkával:

1. **Spark leválasztás + build újjáélesztés** (becslés: 1–2 nap)  
   `useKV` saját implementáció, Vite-pluginek törlése, AI bulk-import feature flag mögé. Cél: `npm install && npm run build` működjön tiszta környezetben.
2. **App.tsx dekompozíció + egyetlen sablonszerkesztő meghagyása** (becslés: 2–3 nap)  
   Feature folderek, router bevezetése, két duplikált sablonszerkesztő törlése, duplikált utility-k egy helyre.

Utána jöhet a globális tesztháló, a HTML escape, a virtualizált táblázat, az i18n, stb.

---

*Készítette: Claude (Sonnet 4.7), 2026-04-23.*
