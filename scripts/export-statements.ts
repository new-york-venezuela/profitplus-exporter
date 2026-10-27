import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPool } from '@/lib/db/mssql';
import { exportStatements } from '@/lib/statements/batch';
import { generateStatementPdf } from '@/lib/statements/generate';
import { fetchCompanyName, fetchUsdRates, listCustomersWithOpenDocs } from '@/lib/statements/repo';

function parseOut(argv: string[]): string | null {
  const i = argv.indexOf('--out');
  const v = i >= 0 ? argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : null;
}

async function main(): Promise<number> {
  const out = parseOut(process.argv.slice(2));
  if (!out) {
    console.error('Uso: bun run statements:export --out <carpeta>');
    return 2;
  }
  const dir = path.resolve(out);
  await mkdir(dir, { recursive: true });

  const pool = await getPool();
  try {
    const rates = await fetchUsdRates(pool);
    const company = await fetchCompanyName(pool);
    const summary = await exportStatements({
      listCandidates: () => listCustomersWithOpenDocs(pool),
      generate: (coCli) => generateStatementPdf(pool, coCli, { rates, company }),
      write: async (fileName, pdf) => {
        const final = path.join(dir, fileName);
        const tmp = `${final}.tmp`;
        try {
          await writeFile(tmp, pdf);
          await rename(tmp, final);
        } catch (err) {
          await rm(tmp, { force: true });
          throw err;
        }
      },
      log: (m) => console.warn(m),
    });
    console.log(
      `[export-statements] ${new Date().toISOString()} — ` +
      `written=${summary.written} skipped=${summary.skipped} failed=${summary.failed}`
    );
    return summary.failed > 0 ? 1 : 0;
  } finally {
    await pool.close();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('[export-statements] fatal error:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
