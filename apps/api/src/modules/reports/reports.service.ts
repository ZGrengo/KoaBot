import { Injectable } from '@nestjs/common';
import { ReceptionsService } from '../operations/receptions.service';
import { WastagesService } from '../operations/wastages.service';
import { ProductionsService } from '../operations/productions.service';
import { SheetsRepository } from '../sheets/sheets.repository';
import { chromium } from 'playwright';

@Injectable()
export class ReportsService {
  constructor(
    private readonly receptionsService: ReceptionsService,
    private readonly wastagesService: WastagesService,
    private readonly productionsService: ProductionsService,
    private readonly sheetsRepository: SheetsRepository
  ) {}

  async generateWeeklyReport(from: string, to: string): Promise<Buffer> {
    const [receptions, wastages, productions] = await Promise.all([
      this.receptionsService.findByDateRange(from, to),
      this.wastagesService.findByDateRange(from, to),
      this.productionsService.findByDateRange(from, to)
    ]);

    // Get user names for productions
    const allUsers = await this.sheetsRepository.getRows<{
      user_id: string;
      name: string;
    }>('users');
    const userMap = new Map(allUsers.map((u) => [u.user_id, u.name]));

    const html = this.generateHtmlReport(from, to, receptions, wastages, productions, userMap);

    // Generate PDF using Playwright
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      printBackground: true
    });
    await browser.close();

    return Buffer.from(pdfBuffer);
  }

  private generateHtmlReport(
    from: string,
    to: string,
    receptions: any[],
    wastages: any[],
    productions: any[],
    userMap: Map<string, string>
  ): string {
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    };

    const formatDateTime = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const receptionRows = receptions.flatMap((rec) =>
      rec.items.map((item: any) => ({
        occurredAt: formatDate(rec.reception.occurredAt),
        supplier: rec.reception.supplier,
        ref: item.ref,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit
      }))
    );

    const wastageRows = wastages.map((w) => ({
      occurredAt: formatDate(w.occurredAt),
      ref: w.ref,
      product: w.product,
      quantity: w.quantity,
      unit: w.unit,
      reason: w.reason || '-'
    }));

    const productionRows = productions.flatMap((prod) =>
      prod.outputs.map((out: any) => ({
        occurredAt: formatDate(prod.production.occurredAt),
        batchName: prod.production.batchName,
        ref: out.ref,
        product: out.product,
        quantity: out.quantity,
        unit: out.unit,
        producedBy: userMap.get(prod.production.producedByUserId) || prod.production.producedByUserId
      }))
    );

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte Semanal</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 10pt;
      color: #333;
      line-height: 1.4;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
      padding-bottom: 15px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: 18pt;
      margin-bottom: 5px;
    }
    .header .date-range {
      font-size: 11pt;
      color: #666;
    }
    .section {
      margin-bottom: 25px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 10px;
      padding: 8px;
      background-color: #f0f0f0;
      border-left: 4px solid #333;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 9pt;
    }
    th {
      background-color: #333;
      color: white;
      padding: 8px 6px;
      text-align: left;
      font-weight: bold;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #ddd;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .empty-message {
      text-align: center;
      padding: 20px;
      color: #999;
      font-style: italic;
    }
    .footer {
      margin-top: 30px;
      padding-top: 15px;
      border-top: 1px solid #ddd;
      text-align: center;
      font-size: 8pt;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Reporte Semanal</h1>
    <div class="date-range">${formatDate(from)} - ${formatDate(to)}</div>
  </div>

  <div class="section">
    <div class="section-title">Recepción</div>
    ${receptionRows.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Proveedor</th>
          <th>Ref</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Unidad</th>
        </tr>
      </thead>
      <tbody>
        ${receptionRows.map((row) => `
        <tr>
          <td>${row.occurredAt}</td>
          <td>${row.supplier}</td>
          <td>${row.ref}</td>
          <td>${row.product}</td>
          <td>${row.quantity}</td>
          <td>${row.unit}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<div class="empty-message">No hay datos de recepción en este período</div>'}
  </div>

  <div class="section">
    <div class="section-title">Merma</div>
    ${wastageRows.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Ref</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Unidad</th>
          <th>Motivo</th>
        </tr>
      </thead>
      <tbody>
        ${wastageRows.map((row) => `
        <tr>
          <td>${row.occurredAt}</td>
          <td>${row.ref}</td>
          <td>${row.product}</td>
          <td>${row.quantity}</td>
          <td>${row.unit}</td>
          <td>${row.reason}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<div class="empty-message">No hay datos de merma en este período</div>'}
  </div>

  <div class="section">
    <div class="section-title">Producción</div>
    ${productionRows.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Fecha</th>
          <th>Lote</th>
          <th>Ref</th>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Unidad</th>
          <th>Producido por</th>
        </tr>
      </thead>
      <tbody>
        ${productionRows.map((row) => `
        <tr>
          <td>${row.occurredAt}</td>
          <td>${row.batchName}</td>
          <td>${row.ref}</td>
          <td>${row.product}</td>
          <td>${row.quantity}</td>
          <td>${row.unit}</td>
          <td>${row.producedBy}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<div class="empty-message">No hay datos de producción en este período</div>'}
  </div>

  <div class="footer">
    Generado el ${formatDateTime(new Date().toISOString())}
  </div>
</body>
</html>
    `.trim();
  }
}

