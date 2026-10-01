// lib/geo/geocode-cli.ts
import type { ProviderMode } from './geocoding';

export interface GeocodeArgs {
  apply: boolean;
  force: boolean;
  provider: ProviderMode;
  limit: number | null;
}

const PROVIDERS: ProviderMode[] = ['osm', 'google', 'both'];

export function parseGeocodeArgs(argv: string[]): GeocodeArgs {
  const out: GeocodeArgs = { apply: false, force: false, provider: 'both', limit: null };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=', 2);
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--apply': out.apply = true; break;
      case '--force': out.force = true; break;
      case '--provider': {
        const v = value() as ProviderMode;
        if (!PROVIDERS.includes(v)) throw new Error(`provider inválido: ${v} (osm | google | both)`);
        out.provider = v; break;
      }
      case '--limit': {
        const n = Number(value());
        if (!Number.isInteger(n) || n < 1) throw new Error('limit debe ser un entero ≥ 1');
        out.limit = n; break;
      }
      default: throw new Error(`Argumento desconocido: ${flag}`);
    }
  }
  return out;
}

export function pickAddress(row: { dirEnt2: string | null; direc1: string | null }):
  { address: string; source: 'dir_ent2' | 'direc1' } | null {
  const ent = row.dirEnt2?.trim();
  if (ent) return { address: ent, source: 'dir_ent2' };
  const fis = row.direc1?.trim();
  if (fis) return { address: fis, source: 'direc1' };
  return null;
}
