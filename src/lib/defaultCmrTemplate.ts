export const DEFAULT_CMR_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CMR - {{sequenceNumber}}</title>
</head>
<body>
  <div class="cmr-document">
    <div class="sequence-number">Saját rendelési szám: {{sequenceNumber}}</div>

    <div class="header">
      <h1>NEMZETKÖZI FUVARLEVÉL</h1>
      <h2>INTERNATIONAL CONSIGNMENT NOTE</h2>
    </div>

    <div class="notice-box">
      This carriage is subject, notwithstanding any clause to the contrary to the Convention on the Contract for the international Carriage of goods by road (CMR).<br>
      A fuvarozásra elétrő megállapodás esetén is a nemzetközi árufuvarozási egyezmény CMR rendelkezései az irányadók
    </div>

    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">1. Feladó (Név, cím, ország)<br>Sender (Name, Address, Country)</div>
        <div class="section-content">
          <strong>{{senderName}}</strong><br>
          {{senderAddress}}<br>
          {{senderCity}}, {{senderCountry}}<br>
          Adószám: {{senderTaxNumber}}
        </div>
      </div>

      <div class="section">
        <div class="section-title">2. Átvevő (Név, cím, ország)<br>Consignee (Name, Address, Country)</div>
        <div class="section-content">
          <strong>{{customerName}}</strong><br>
          {{customerAddress}}<br>
          {{customerCity}}, {{customerCountry}}<br>
          {{customerTaxNumber}}
        </div>
      </div>

      <div class="section">
        <div class="section-title">3. Az áru átvételének helye és időpontja<br>Place and date of delivery of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{pickupLocation}}</strong><br>
          Ország / Country: <strong>{{senderCountry}}</strong>
        </div>
      </div>

      <div class="section">
        <div class="section-title">4. Az áru leadásának helye és időpontja<br>Place and date of taking over of the goods</div>
        <div class="section-content">
          Helység / Place: <strong>{{customerCity}}</strong><br>
          Ország / Country: <strong>{{customerCountry}}</strong>
        </div>
      </div>

      <div class="section">
        <div class="section-title">16. Carrier (Name, Address, Country)<br>Fuvarozó (Név, cím, ország)</div>
        <div class="section-content">
          {{carrierName}}<br>
          {{carrierAddress}}
        </div>
      </div>

      <div class="section">
        <div class="section-title">17. Successive carriers<br>További fuvarozó</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>

      <div class="section">
        <div class="section-title">5. Mellékelt okmányok<br>Documents attached</div>
        <div class="section-content">
          Szállítólevél
        </div>
      </div>

      <div class="section">
        <div class="section-title">18. Carrier's reservations and observations<br>A fuvarozó fenntartásai és bejegyzése</div>
        <div class="section-content">
          &nbsp;
        </div>
      </div>
    </div>

    <table class="goods-table">
      <thead>
        <tr>
          <th>Jel és szám<br>Marks and Nos</th>
          <th>Vevő rendelési száma<br>Customer Order No</th>
          <th>Darabszám<br>Number of packages</th>
          <th>Csomagolás<br>Method of packing</th>
          <th>Áru megnevezése<br>Nature of the goods</th>
          <th>Bruttósúly kg<br>Gross weight kg</th>
        </tr>
      </thead>
      <tbody>
        {{#items}}
        <tr>
          <td class="center">{{index}}</td>
          <td class="center">{{ownOrderNumber}}</td>
          <td class="center">{{quantity}}</td>
          <td>{{packaging}}</td>
          <td>{{productName}}<br><small>{{designation}}</small></td>
          <td class="right">{{weight}}</td>
        </tr>
        {{/items}}
      </tbody>
    </table>

    <div class="section full-width">
      <div class="section-title">13. Sender's instructions (Customs and other formalities)<br>Feladó rendelkezései (Vám és egyéb hivatalos kezelés)</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>

    <div class="cmr-grid">
      <div class="section">
        <div class="section-title">14. Cash on delivery<br>Visszatérítés</div>
        <div class="section-content">
          -
        </div>
      </div>

      <div class="section">
        <div class="section-title">19. To be paid by / Fizetendő</div>
        <div class="section-content">
          Sender / Feladó: ☐<br>
          Consignee / Átvevő: ☐<br>
          Currency / Pénznem: EUR
        </div>
      </div>
    </div>

    <div class="section full-width">
      <div class="section-title">15. Directions as to payment for carriage<br>Fuvardíjfizetési meghagyások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>

    <div class="section full-width">
      <div class="section-title">20. Special agreements<br>Egyedi megállapodások</div>
      <div class="section-content">
        &nbsp;
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          21. Kiállítás helye<br>
          <span class="signature-label-sub">Place issued</span>
        </div>
        <div class="section-content">
          <strong>{{pickupLocation}}</strong><br>
          Dátum: {{issueDate}}
        </div>
      </div>

      <div class="signature-box">
        <div class="signature-label">
          22. A feladó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the sender</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>

      <div class="signature-box">
        <div class="signature-label">
          23. Fuvarozó aláírása és bélyegzője<br>
          <span class="signature-label-sub">Signature and stamp of the carrier</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">
          24. Goods received / Áru átvétele<br>
          <span class="signature-label-sub">Date / Dátum</span>
        </div>
        <div class="signature-space">
          (dátum / date)
        </div>
      </div>

      <div class="signature-box" style="grid-column: 2 / -1;">
        <div class="signature-label">
          Signature and stamp of the consignee<br>
          <span class="signature-label-sub">Az átvevő aláírása és bélyegzője</span>
        </div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>

    <div class="signature-section">
      <div class="signature-box" style="grid-column: 1 / -1;">
        <div class="signature-label">
          25. Vehicle / Jármű
        </div>
        <div class="section-content">
          Rendszám / Registration number: <strong>{{vehiclePlate}}</strong>
        </div>
      </div>
    </div>

  </div>

  <div class="no-print" style="text-align: center; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer;">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
  </div>
</body>
</html>`

export const DEFAULT_CMR_TEMPLATE_CSS = `@page {
  size: A4;
  margin: 10mm;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: Arial, sans-serif;
  font-size: 10pt;
  line-height: 1.3;
  color: #000;
}

.cmr-document {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: white;
  padding: 5mm;
  position: relative;
}

.header {
  text-align: center;
  margin-bottom: 10px;
  border-bottom: 2px solid #000;
  padding-bottom: 5px;
}

.header h1 {
  font-size: 14pt;
  font-weight: bold;
  margin-bottom: 2px;
}

.header h2 {
  font-size: 11pt;
  font-weight: normal;
  font-style: italic;
}

.sequence-number {
  position: absolute;
  top: 5mm;
  right: 5mm;
  font-size: 12pt;
  font-weight: bold;
}

.cmr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.section {
  border: 1px solid #000;
  padding: 8px;
  background: #fff;
}

.section-title {
  font-size: 9pt;
  font-weight: bold;
  margin-bottom: 5px;
  text-decoration: underline;
}

.section-content {
  font-size: 10pt;
  line-height: 1.4;
}

.section-content strong {
  font-weight: bold;
}

.full-width {
  grid-column: 1 / -1;
}

.goods-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
  font-size: 9pt;
}

.goods-table th,
.goods-table td {
  border: 1px solid #000;
  padding: 4px 6px;
  text-align: left;
}

.goods-table th {
  background: #e0e0e0;
  font-weight: bold;
  text-align: center;
}

.goods-table td.center {
  text-align: center;
}

.goods-table td.right {
  text-align: right;
}

.signature-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-top: 20px;
  page-break-inside: avoid;
}

.signature-box {
  border: 1px solid #000;
  padding: 8px;
  min-height: 80px;
}

.signature-label {
  font-size: 8pt;
  font-weight: bold;
  margin-bottom: 5px;
}

.signature-label-sub {
  font-size: 7pt;
  font-style: italic;
  color: #666;
}

.signature-space {
  margin-top: 40px;
  border-top: 1px solid #666;
  padding-top: 3px;
  text-align: center;
  font-size: 7pt;
}

.notice-box {
  border: 1px solid #000;
  padding: 5px;
  font-size: 7pt;
  text-align: center;
  margin-bottom: 10px;
  background: #f9f9f9;
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }

  .cmr-document {
    margin: 0;
    padding: 5mm;
  }

  .no-print {
    display: none;
  }
}`
