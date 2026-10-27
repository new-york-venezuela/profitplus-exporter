import { existsSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import type { Money, Statement, StatementRow } from './types';

export interface RenderStatementInput {
  company: string;
  logoPath: string | null;
  customer: { coCli: string; name: string; rif: string | null; address: string | null };
  statement: Statement;
}

const MARGIN = 40;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - 60;
const ROW_H = 16;

const COLS = [
  { key: 'tipo', label: 'Tipo', w: 44, align: 'left' },
  { key: 'nro', label: 'Nro. documento', w: 76, align: 'left' },
  { key: 'emis', label: 'Fecha de emisión', w: 80, align: 'left' },
  { key: 'venc', label: 'Vencimiento', w: 66, align: 'left' },
  { key: 'mora', label: 'Días de mora', w: 56, align: 'right' },
  { key: 'bsd', label: 'Monto Bs', w: 76, align: 'right' },
  { key: 'tasa', label: 'Tasa', w: 50, align: 'right' },
  { key: 'usd', label: 'Monto USD', w: 67, align: 'right' },
] as const;

/** es-VE style: thousands '.', decimal ','. Manual so it does not depend on ICU data. */
function fmtAmount(n: number): string {
  const rounded = Math.round(Math.abs(n) * 100) / 100;
  const [int, dec] = rounded.toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const neg = n < 0 && rounded !== 0;
  return `${neg ? '-' : ''}${grouped},${dec}`;
}

function fmtDate(d: Date | null): string {
  if (!d) return '-';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function statementFileName(coCli: string, name: string): string {
  const clean = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  const trim = (x: string) => x.replace(/^[-.]+|[-.]+$/g, '');
  const c = trim(clean(coCli));
  const n = trim(clean(name));
  const base = [c, n].filter(Boolean).join('-');
  if (!base) return 'estado-de-cuenta.pdf';
  const max = 80 - '.pdf'.length;
  return `${trim(base.slice(0, max)) || 'estado-de-cuenta'}.pdf`;
}

export function renderStatementPdf(input: RenderStatementInput): Promise<Buffer> {
  const { company, logoPath, customer, statement } = input;
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: `Estado de cuenta ${customer.coCli}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      let y = MARGIN;

      // Header: logo + company + title
      let textX = MARGIN;
      if (logoPath && existsSync(logoPath)) {
        try {
          doc.image(logoPath, MARGIN, y, { fit: [60, 50] });
          textX = MARGIN + 70;
        } catch {
          textX = MARGIN;
        }
      }
      const companyName = company.trim();
      if (companyName) {
        doc.font('Helvetica-Bold').fontSize(13).fillColor('#000');
        doc.text(companyName, textX, y, { width: CONTENT_W - (textX - MARGIN), lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(16);
        doc.text('Estado de cuenta', textX, y + 18, { lineBreak: false });
      } else {
        doc.font('Helvetica-Bold').fontSize(16).fillColor('#000');
        doc.text('Estado de cuenta', textX, y + 6, { lineBreak: false });
      }
      doc.font('Helvetica').fontSize(9);
      doc.text(`Al ${fmtDate(statement.asOf)}`, MARGIN, y, {
        width: CONTENT_W,
        align: 'right',
        lineBreak: false,
      });
      y += 60;

      // Customer block
      doc.font('Helvetica-Bold').fontSize(10);
      doc.text(`${customer.coCli} - ${customer.name}`, MARGIN, y, {
        width: CONTENT_W,
        lineBreak: false,
        ellipsis: true,
      });
      y += 14;
      doc.font('Helvetica').fontSize(9);
      if (customer.rif) {
        doc.text(`RIF: ${customer.rif}`, MARGIN, y, { lineBreak: false });
        y += 12;
      }
      if (customer.address) {
        const h = doc.heightOfString(customer.address, { width: CONTENT_W });
        doc.text(customer.address, MARGIN, y, { width: CONTENT_W });
        y += h + 2;
      }
      y += 8;

      const drawTableHeader = (yy: number): number => {
        doc.save().rect(MARGIN, yy, CONTENT_W, ROW_H + 2).fill('#e8e8e8').restore();
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#000');
        let x = MARGIN;
        for (const c of COLS) {
          doc.text(c.label, x + 2, yy + 5, {
            width: c.w - 4,
            align: c.align,
            lineBreak: false,
          });
          x += c.w;
        }
        return yy + ROW_H + 4;
      };

      const cells = (r: StatementRow): string[] => [
        r.unknownType ? `${r.coTipoDoc}*` : r.coTipoDoc,
        r.nroDoc,
        fmtDate(r.fecEmis),
        fmtDate(r.fecVenc),
        r.daysOverdue === null ? '-' : String(r.daysOverdue),
        fmtAmount(r.amountBsd),
        r.rate === null ? 'Sin tasa' : fmtAmount(r.rate),
        r.amountUsd === null ? '-' : fmtAmount(r.amountUsd),
      ];

      // Aging summary at the top, before the table
      const line = (label: string, v: Money, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor('#000');
        doc.text(label, MARGIN + 2, y, { width: 200, lineBreak: false });
        doc.text(`Bs ${fmtAmount(v.bsd)}`, MARGIN + 200, y, { width: 120, align: 'right', lineBreak: false });
        doc.text(`USD ${fmtAmount(v.usd)}`, MARGIN + 330, y, { width: 120, align: 'right', lineBreak: false });
        y += 14;
      };
      doc.font('Helvetica-Bold').fontSize(10).text('Resumen de antigüedad', MARGIN, y, { lineBreak: false });
      y += 16;
      const a = statement.aging;
      line('Por vencer', a.porVencer);
      line('1 a 30 días', a.d1_30);
      line('31 a 60 días', a.d31_60);
      line('61 a 90 días', a.d61_90);
      line('Más de 90 días', a.d90plus);
      line('Créditos y anticipos', statement.credits);
      y += 8;

      if (y + ROW_H * 3 > BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }
      y = drawTableHeader(y);
      doc.font('Helvetica').fontSize(8);
      statement.rows.forEach((r, i) => {
        if (y + ROW_H > BOTTOM) {
          doc.addPage();
          y = drawTableHeader(MARGIN);
        }
        if (i % 2 === 1) doc.save().rect(MARGIN, y - 2, CONTENT_W, ROW_H).fill('#f6f6f6').restore();
        doc.font('Helvetica').fontSize(8).fillColor(r.kind === 'reducing' ? '#1a5e1a' : '#000');
        let x = MARGIN;
        cells(r).forEach((t, ci) => {
          doc.text(t, x + 2, y + 1, { width: COLS[ci].w - 4, align: COLS[ci].align, lineBreak: false });
          x += COLS[ci].w;
        });
        y += ROW_H;
      });
      doc.fillColor('#000');
      if (statement.rows.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(9);
        doc.text('Sin documentos pendientes.', MARGIN + 2, y + 2, { lineBreak: false });
        y += ROW_H;
      }

      // Grand total + notes at the end (reserve space so they stay together)
      const need = 40 + (statement.incomplete ? 18 : 0) + (statement.rows.some((r) => r.unknownType) ? 14 : 0);
      if (y + need > BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }
      y += 6;
      doc.moveTo(MARGIN, y).lineTo(MARGIN + CONTENT_W, y).lineWidth(0.5).stroke('#000');
      y += 4;
      line('Total', statement.total, true);

      if (statement.incomplete) {
        y += 4;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#a00000');
        doc.text('Estado de cuenta incompleto: faltan tasas de cambio', MARGIN + 2, y, {
          width: CONTENT_W,
          lineBreak: false,
        });
        doc.fillColor('#000');
        y += 14;
      }
      if (statement.rows.some((r) => r.unknownType)) {
        doc.font('Helvetica').fontSize(8);
        doc.text('* Tipo de documento no reconocido', MARGIN + 2, y + 2, { lineBreak: false });
      }

      // Footers
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(8).fillColor('#555');
        doc.text(`Página ${i + 1} de ${range.count}`, MARGIN, PAGE_H - 35, {
          width: CONTENT_W,
          align: 'center',
          lineBreak: false,
        });
      }
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
