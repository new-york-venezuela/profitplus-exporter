// Run as a subprocess from a foreign cwd by render-pdf.test.ts. Imports render-pdf by absolute path.
import path from 'node:path';

const { renderStatementPdf } = await import(path.resolve(import.meta.dir, '..', 'render-pdf.ts'));
const m = (bsd: number, usd: number) => ({ bsd, usd });
const pdf: Buffer = await renderStatementPdf({
  company: 'X',
  logoPath: null,
  customer: { coCli: 'C', name: 'N', rif: null, address: null },
  statement: {
    asOf: new Date(), rows: [],
    aging: { porVencer: m(0, 0), d1_30: m(0, 0), d31_60: m(0, 0), d61_90: m(0, 0), d90plus: m(0, 0) },
    credits: m(0, 0), total: m(0, 0), incomplete: false,
  },
});
process.stdout.write(pdf.subarray(0, 5).toString());
