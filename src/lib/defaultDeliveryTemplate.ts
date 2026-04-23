export const DEFAULT_DELIVERY_TEMPLATE_HTML = `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Szállítólevél - {{sequenceNumber}}</title>
</head>
<body>
  <div class="delivery-document">
    <div class="content-wrapper">
      <div class="sequence-number">Szám: {{sequenceNumber}}</div>
      
      <div class="header">
        <h1>SZÁLLÍTÓLEVÉL</h1>
        <p>Delivery Note</p>
      </div>
      
      <div class="info-section">
        <div class="info-box">
          <h3>Feladó / Sender</h3>
          <p><strong>{{senderName}}</strong></p>
          <p>{{senderAddress}}</p>
          <p>Adószám: {{senderTaxNumber}}</p>
          <p>Dátum: {{issueDate}}</p>
        </div>
        
        <div class="info-box">
          <h3>Címzett / Consignee</h3>
          <p><strong>{{customerName}}</strong></p>
          <p>{{customerAddress}}</p>
          <p>{{customerCity}}, {{customerCountry}}</p>
          <p>Adószám: {{customerTaxNumber}}</p>
        </div>
      </div>
      
      <table class="delivery-table">
        <thead>
          <tr>
            <th style="width: 15%;">Saját rendelési szám</th>
            <th style="width: 15%;">Vevő rendelési száma</th>
            <th style="width: 30%;">Termék név</th>
            <th style="width: 10%;">Mennyiség (db)</th>
            <th style="width: 10%;">Dobozok száma</th>
            <th style="width: 10%;">Raklapok száma</th>
            <th style="width: 10%;">Bruttó súly (kg)</th>
          </tr>
        </thead>
        <tbody>
          {{#items}}
            <tr>
              <td class="center">{{orderNumber}}</td>
              <td class="center">{{ownOrderNumber}}</td>
              <td>{{productName}}</td>
              <td class="center">{{quantity}}</td>
              <td class="center">{{boxes}}</td>
              <td class="center">{{pallets}}</td>
              <td class="right">{{weight}}</td>
            </tr>
          {{/items}}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="right"><strong>Összesen:</strong></td>
            <td class="center"><strong>{{totalQuantity}}</strong></td>
            <td class="center"><strong>{{totalBoxes}}</strong></td>
            <td class="center"><strong>{{totalPallets}}</strong></td>
            <td class="right"><strong>{{totalWeight}}</strong></td>
          </tr>
        </tfoot>
      </table>
      
      <div class="footer">
        <p>Ez egy számítógép által generált dokumentum. / This is a computer-generated document.</p>
        <p>Magma Kft • H-1211 Budapest, Déli utca 13. • HU10368152-2-43</p>
      </div>
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">Feladó aláírása és bélyegzője<br>Sender's signature and stamp</div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
      
      <div class="signature-box">
        <div class="signature-label">Átvevő aláírása és bélyegzője<br>Consignee's signature and stamp</div>
        <div class="signature-space">
          (aláírás / signature)
        </div>
      </div>
    </div>
  </div>
  
  <div class="no-print" style="text-align: center; padding: 20px;">
    <button onclick="window.print()" style="padding: 10px 20px; font-size: 14pt; cursor: pointer; background: #2c5aa0; color: white; border: none; border-radius: 5px;">
      🖨️ Nyomtatás / Mentés PDF-ként
    </button>
  </div>
</body>
</html>`

export const DEFAULT_DELIVERY_TEMPLATE_CSS = `@page {
  size: A4 portrait;
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
  color: #000000;
  background: #f5f5f5;
  padding: 10px;
}

.delivery-document {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: #ffffff;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1 0 auto;
}

.header {
  text-align: center;
  margin-bottom: 15px;
  border-bottom: 2px solid #2c5aa0;
  padding-bottom: 10px;
}

.header h1 {
  font-size: 20pt;
  font-weight: bold;
  color: #2c5aa0;
  margin-bottom: 5px;
}

.sequence-number {
  position: absolute;
  top: 20px;
  right: 20px;
  font-size: 14pt;
  font-weight: bold;
  color: #2c5aa0;
}

.info-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.info-box {
  border: 2px solid #2c5aa0;
  padding: 10px;
  border-radius: 5px;
  background: #f8f9fa;
}

.info-box h3 {
  font-size: 11pt;
  font-weight: bold;
  color: #2c5aa0;
  margin-bottom: 8px;
  border-bottom: 1px solid #2c5aa0;
  padding-bottom: 3px;
}

.info-box p {
  margin: 3px 0;
  font-size: 10pt;
}

.info-box strong {
  font-weight: bold;
}

.delivery-table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
  font-size: 9pt;
}

.delivery-table th,
.delivery-table td {
  border: 1px solid #666666;
  padding: 6px;
  text-align: left;
}

.delivery-table th {
  background: #2c5aa0;
  color: #ffffff;
  font-weight: bold;
  text-align: center;
}

.delivery-table td.center {
  text-align: center;
}

.delivery-table td.right {
  text-align: right;
}

.delivery-table tbody tr:nth-child(even) {
  background: #f8f9fa;
}

.delivery-table tbody tr:hover {
  background: #e3f2fd;
}

.delivery-table tfoot {
  font-weight: bold;
  background: #e0e0e0;
}

.signature-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-top: auto;
  padding-top: 30px;
  page-break-inside: avoid;
}

.signature-box {
  border: 1px solid #666666;
  padding: 10px;
  min-height: 100px;
  border-radius: 5px;
}

.signature-label {
  font-size: 10pt;
  font-weight: bold;
  margin-bottom: 10px;
  color: #2c5aa0;
}

.signature-space {
  margin-top: 50px;
  border-top: 1px solid #666666;
  padding-top: 5px;
  text-align: center;
  font-size: 8pt;
  color: #666666;
}

.footer {
  margin-top: 20px;
  text-align: center;
  font-size: 8pt;
  color: #666666;
  border-top: 1px solid #ccc;
  padding-top: 10px;
}

@media print {
  body {
    margin: 0;
    padding: 0;
  }
  
  .delivery-document {
    margin: 0;
    padding: 10mm;
  }
  
  .no-print {
    display: none;
  }
}`
