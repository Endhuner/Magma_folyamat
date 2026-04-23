# CMR Template

Ez a mappa tartalmazza a CMR export sablonokat.

## Fájlok

- **Cmr.xltx**: Az alapértelmezett CMR sablon fájl (Excel template formátum)
- **Cmr.xls**: Régebbi sablon fájl (korábbi verzióhoz)

## Használat

A CMR exportálás az **xlsx-template** könyvtárat használja a `Cmr.xltx` fájl kitöltéséhez.

A CMR gomb megnyomásakor a rendszer:
1. Betölti a `Cmr.xltx` sablont
2. Kitölti a megfelelő adatokkal (szállítólevél száma, vevő adatok, stb.)
3. Elmenti a kitöltött fájlt és letölti
4. Menti a szállítólevél bejegyzést a rendszerbe

Az exportált fájl a böngésző letöltési mappájába kerül.
