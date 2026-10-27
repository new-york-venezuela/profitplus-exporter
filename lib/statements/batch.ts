import type { Statement } from './types';

export interface BatchDeps {
  listCandidates(): Promise<string[]>;
  generate(coCli: string): Promise<{ pdf: Buffer; fileName: string; statement: Statement } | null>;
  write(fileName: string, pdf: Buffer): Promise<void>;
  log(msg: string): void;
}

export interface BatchSummary {
  written: number;
  skipped: number;
  failed: number;
}

/** Writes one PDF per customer whose net BSD balance is > 0. A failure never stops the batch. */
export async function exportStatements(deps: BatchDeps): Promise<BatchSummary> {
  const summary: BatchSummary = { written: 0, skipped: 0, failed: 0 };
  const usedNames = new Set<string>();
  const candidates = await deps.listCandidates();
  for (const coCli of candidates) {
    try {
      const generated = await deps.generate(coCli);
      if (!generated || !(generated.statement.total.bsd > 0)) {
        summary.skipped++;
        continue;
      }
      if (generated.statement.incomplete) {
        deps.log(`[export-statements] ${coCli}: estado de cuenta incompleto (documentos sin tasa)`);
      }
      const key = generated.fileName.toLowerCase();
      if (usedNames.has(key)) {
        throw new Error(`duplicate file name in this run: ${generated.fileName}`);
      }
      usedNames.add(key);
      await deps.write(generated.fileName, generated.pdf);
      summary.written++;
    } catch (err) {
      summary.failed++;
      deps.log(`[export-statements] ${coCli}: failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return summary;
}
