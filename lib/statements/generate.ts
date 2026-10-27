import { existsSync } from 'node:fs';
import path from 'node:path';
import type sql from 'mssql';
import { buildStatement } from './build-statement';
import * as repo from './repo';
import { renderStatementPdf, statementFileName } from './render-pdf';
import type { Statement, UsdRate } from './types';

export interface Deps {
  fetchCustomerHeader: typeof repo.fetchCustomerHeader;
  fetchOpenDocs: typeof repo.fetchOpenDocs;
  fetchUsdRates: typeof repo.fetchUsdRates;
  fetchCompanyName: typeof repo.fetchCompanyName;
  renderStatementPdf: typeof renderStatementPdf;
}

const defaultDeps: Deps = {
  fetchCustomerHeader: repo.fetchCustomerHeader,
  fetchOpenDocs: repo.fetchOpenDocs,
  fetchUsdRates: repo.fetchUsdRates,
  fetchCompanyName: repo.fetchCompanyName,
  renderStatementPdf,
};

export interface GeneratedStatement {
  pdf: Buffer;
  fileName: string;
  statement: Statement;
  customerName: string;
}

/** Returns null when the customer does not exist. */
export async function generateStatementPdf(
  pool: sql.ConnectionPool,
  coCli: string,
  opts: { rates?: UsdRate[]; company?: string; asOf?: Date; deps?: Partial<Deps> } = {},
): Promise<GeneratedStatement | null> {
  const d: Deps = { ...defaultDeps, ...opts.deps };
  const header = await d.fetchCustomerHeader(pool, coCli);
  if (!header) return null;
  const [docs, rates, company] = await Promise.all([
    d.fetchOpenDocs(pool, coCli),
    opts.rates ? Promise.resolve(opts.rates) : d.fetchUsdRates(pool),
    opts.company !== undefined ? Promise.resolve(opts.company) : d.fetchCompanyName(pool),
  ]);
  const statement = buildStatement(docs, rates, opts.asOf ?? new Date());
  for (const row of statement.rows) {
    if (row.unknownType) {
      console.warn(`[statements] unknown document type: co_cli=${coCli} nro_doc=${row.nroDoc} co_tipo_doc=${row.coTipoDoc}`);
    }
  }
  const logo = path.join(process.cwd(), 'public', 'statement-logo.png');
  const pdf = await d.renderStatementPdf({
    company,
    logoPath: existsSync(logo) ? logo : null,
    customer: header,
    statement,
  });
  return { pdf, fileName: statementFileName(header.coCli, header.name), statement, customerName: header.name };
}
