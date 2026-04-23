CMR SABLON HELYETTESÍTŐ VÁLTOZÓK
=================================

A Cmr.xltx sablonban a következő változókat használhatod a cellákban:
(Formátum: ${valtozo_neve})

SZÁLLÍTÓLEVÉL ADATOK:
- ${szallitolevel_szama} - Szállítólevél sorszáma
- ${deliveryNoteNumber} - Szállítólevél száma (alternatív)

FELADÓ ADATOK:
- ${senderName} - Feladó neve
- ${senderAddress} - Feladó címe
- ${senderTaxNumber} - Feladó adószáma

CÍMZETT ADATOK:
- ${customer_name} - Vevő neve
- ${consigneeName} - Címzett neve (alternatív)
- ${customer_address} - Vevő teljes címe
- ${consigneeAddress} - Címzett címe (alternatív)
- ${customer_city} - Vevő városa
- ${consigneeCity} - Címzett városa (alternatív)
- ${customer_country} - Vevő országa
- ${consigneeCountry} - Címzett országa (alternatív)
- ${consigneeTaxNumber} - Címzett adószáma
- ${consigneePostalCode} - Címzett irányítószáma

SZÁLLÍTÁSI ADATOK:
- ${placeOfDelivery} - Átvétel helye
- ${deliveryCountry} - Átvétel országa
- ${placeOfTakingOver} - Áru átvétel helye
- ${takingOverCountry} - Áru átvétel országa

ÁRU ADATOK:
- ${marksAndNumbers} - Jel és szám
- ${numberOfPackages} - Dobozok száma összesen
- ${methodOfPacking} - Csomagolás módja
- ${natureOfGoods} - Áru megnevezése
- ${grossWeightKg} - Bruttó súly kg összesen
- ${amountPc} - Mennyiség darabban összesen

KIÁLLÍTÁS ADATOK:
- ${placeIssued} - Kiállítás helye
- ${dateIssued} - Kiállítás dátuma

RENDELÉS ADATOK:
- ${ownOrderNumber} - Saját rendelési szám(ok)
- ${customerOrderNumber} - Vevő rendelési szám(ok)
- ${rowCount} - Rendelések száma

PÉLDA HASZNÁLAT A SABLONBAN:
============================

Cella A6: ${customer_name}
Cella A7: ${customer_address}
Cella B12: ${customer_city}
Cella B13: ${customer_country}
Cella K1: ${szallitolevel_szama}

FONTOS:
=======
- A sablon Cmr.xltx fájl kell legyen a /public/templates/ mappában
- A változók ${} formátumban írandók a cellákba
- A rendszer automatikusan helyettesíti be az aktuális adatokat
