# CMR Sablon Mezők Javítása - Összefoglaló

## Dátum: 2025

## Elvégzett Munkák

### 1. Placeholder Nevek Javítása

A CMR sablon exportban használt placeholder neveket módosítottam, hogy megfeleljenek a dokumentációban leírtaknak.

**Módosított fájl:** `src/lib/xlsxTemplateExport.ts`

**Változtatások:**

| Régi Placeholder | Új Placeholder | Cella | Tartalom |
|-----------------|----------------|-------|----------|
| `K1` | `szallitolevel_szama` | K1 | Szállítólevél száma |
| `A6` | `customer_name` | A6 | Vevő neve |
| `A7` | `customer_address` | A7 | Vevő teljes címe |
| `B12` | `customer_city` | B12 | Vevő városa |
| `B13` | `customer_country` | B13 | Vevő országa |

**Hozzáadott mező:**
- `consigneePostalCode` - Vevő irányítószáma (hiányzott korábban)

### 2. Dokumentáció Frissítése

**Frissített fájlok:**

1. **CMR_SABLON_CELLAMAPPING.md**
   - Frissítettem a placeholder táblázatot
   - Hozzáadtam a hiányzó vevő mezőket a dokumentációhoz
   - Pontosítottam az A7 cella leírását (teljes cím vs csak utca)

2. **CMR_TESZT_UTMUTATO.md** (ÚJ)
   - Részletes lépésről-lépésre tesztelési útmutató
   - Vevő, termék és rendelés létrehozási példák
   - Ellenőrzési checklist
   - Gyakori problémák és megoldások
   - Testreszabási tippek

3. **README.md**
   - Frissítettem a CMR sablon szekciót magyarra
   - Hozzáadtam a placeholder listát
   - Hivatkozások a dokumentációs fájlokra

## Placeholder Rendszer Működése

### Excel Sablon Struktúra

```
public/templates/Cmr.xls
```

A sablon fájlban a cellákba `${változónév}` formátumú placeholder-eket kell elhelyezni.

**Példa:**
```
     K
1    ${szallitolevel_szama}

     A                           B
6    ${customer_name}
7    ${customer_address}
...
12                               ${customer_city}
13                               ${customer_country}
```

### Kód Működése

1. **Adatok összegyűjtése** (`buildCmrTemplateValues`)
   - Rendelések adataiból kigyűjti a szükséges információkat
   - Vevő adatokat kombinál egy teljes címmé
   - Számításokat végez (dobozok, raklapok, súly)

2. **Változók létrehozása**
   ```typescript
   {
     szallitolevel_szama: "CMR-2025-001",
     customer_name: "Vevő Kft",
     customer_address: "Utca 10, 1234 Budapest, Hungary",
     customer_city: "Budapest",
     customer_country: "Hungary",
     // ... további mezők
   }
   ```

3. **Sablon feldolgozása** (`generateCmrTemplateWorkbook`)
   - Betölti a sablon fájlt
   - Az `xlsx-template` könyvtár helyettesíti a placeholder-eket
   - Visszaadja a kitöltött Excel fájlt

4. **Letöltés**
   - A böngésző letöltési mappájába menti
   - Fájlnév: `{sorszám}_{vevőnév}.xlsx`

## Tesztelési Folyamat

### Előfeltételek Ellenőrzése

1. ✅ Sablon fájl létezik: `/public/templates/Cmr.xls`
2. ✅ Placeholder-ek helyesen formázva: `${változónév}`
3. ✅ Vevő adatok kitöltve (város, ország, cím)
4. ✅ Termék létezik a vevőhöz
5. ✅ Rendelés létrehozva

### Tesztelési Lépések

1. **Vevő létrehozása** - minden kötelező mező kitöltése
2. **Termék létrehozása** - rajzszám, csomagolási adatok
3. **Rendelés létrehozása** - termék kiválasztása, mennyiség megadása
4. **CMR beállítások** - feladó adatok ellenőrzése
5. **Export** - rendelés kijelölése és CMR generálás
6. **Ellenőrzés** - letöltött fájl megnyitása és cellák vizsgálata

### Sikeres Teszt Kritériumai

- ✅ K1 cella: Szállítólevél száma megjelenik (nem `${szallitolevel_szama}`)
- ✅ A6 cella: Vevő neve megjelenik (nem `${customer_name}`)
- ✅ A7 cella: Teljes cím megjelenik (nem `${customer_address}`)
- ✅ B12 cella: Város megjelenik (nem `${customer_city}`)
- ✅ B13 cella: Ország megjelenik (nem `${customer_country}`)

## Hibák és Megoldások

### Probléma: Placeholder-ek nem cserélődnek ki

**Tünetek:**
- Letöltött fájlban látható: `${customer_name}`
- A cellák nem tartalmazzák a valós adatokat

**Lehetséges okok:**
1. Sablon fájl nem található vagy hibás
2. Placeholder formátum hibás (pl. `$ {customer_name}` extra szóközzel)
3. A változónév nem egyezik a kódban definiálttal

**Megoldás:**
1. Ellenőrizd a sablon fájl helyét: `/public/templates/Cmr.xls`
2. Nyisd meg Excel-ben és ellenőrizd a placeholder formátumot
3. Győződj meg róla, hogy pontosan `${változónév}` formátumú
4. Mentsd újra a sablont

### Probléma: Üres cellák

**Tünetek:**
- A cellák üresek, nem tartalmazzák se a placeholder-t, se az értéket

**Lehetséges okok:**
1. Vevő adatok hiányoznak (város, ország, cím üres)
2. Rendelés nem tartalmaz vevőt
3. A kód nem találja meg a vevő adatokat

**Megoldás:**
1. Ellenőrizd a vevő adatlapon minden mező kitöltését
2. Ellenőrizd, hogy a rendelés tartalmazza a vevő nevét
3. Nézd meg a böngésző konzolt hibaüzenetekért (F12)

### Probléma: Fájl nem töltődik le

**Tünetek:**
- A "CMR" gombra kattintás nem indít letöltést
- Hibaüzenet jelenik meg

**Lehetséges okok:**
1. Nincs kijelölt rendelés
2. Sablon fájl hibás vagy nem található
3. Több vevő rendelései vannak kijelölve

**Megoldás:**
1. Jelölj ki legalább egy rendelést
2. Csak egy vevő rendeléseit jelöld ki egyszerre
3. Ellenőrizd a sablon fájl létezését
4. Nézd meg a konzolt részletes hibaüzenetért

## Következő Fejlesztési Lehetőségek

### 1. Többszörös Rendelések Tesztelése
- Több rendelés egy CMR dokumentumban
- Összesítések helyessége
- Különböző termékek kezelése

### 2. További Placeholder-ek
- Fuvarozó adatok (`${carrier}`)
- Jármű rendszám (`${vehicleRegistration}`)
- Statisztikai szám (`${statisticalNumber}`)
- Térfogat m³ (`${volumeM3}`)

### 3. Szállítólevél Sablon
- Hasonló placeholder rendszer
- Magyar nyelvű szállítólevél formátum
- Termékek részletes listája táblázatban

### 4. Sablon Validáció
- Sablon fájl ellenőrzése betöltéskor
- Hiányzó placeholder-ek figyelmeztetése
- Sablon verziókezelés

## Összefoglalás

A CMR sablon exportálás most már helyesen használja a dokumentált placeholder neveket:
- `szallitolevel_szama` a K1 cellához
- `customer_name` az A6 cellához  
- `customer_address` az A7 cellához
- `customer_city` a B12 cellához
- `customer_country` a B13 cellához

A rendszer képes:
- ✅ Excel sablonok betöltésére
- ✅ Placeholder-ek helyettesítésére
- ✅ Rendelés adatok exportálására
- ✅ Vevő és termék adatok beillesztésére
- ✅ Számított mezők generálására (dobozok, raklapok, súly)
- ✅ Fallback táblázatos exportra hibák esetén

A részletes tesztelési útmutatót lásd: **CMR_TESZT_UTMUTATO.md**
