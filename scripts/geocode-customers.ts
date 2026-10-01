// scripts/geocode-customers.ts
//
// Pre-fills saCliente.campo1 ("Coordenadas: (lat, lng)") from each
// customer's address. DRY-RUN by default — prints what it would write;
// `--apply` writes via pApiActualizarUbicacionCliente. Low-confidence
// and rejected results are never written, only listed for manual
// placement on the /mapa page.
//
//   bun run geocode:customers                  # dry-run, provider both
//   bun run geocode:customers --apply
//   bun run geocode:customers --provider osm --limit 10
//   bun run geocode:customers --force --apply  # also redo customers that already have campo1
import { getPool } from '@/lib/db/mssql';
import { formatCoordinates } from '@/lib/geo/coordinates';
import { normalizeAddress, geocodeAddress } from '@/lib/geo/geocoding';
import { parseGeocodeArgs, pickAddress } from '@/lib/geo/geocode-cli';
import { updateCustomerLocation } from '@/lib/geo/erp-location';

const NOMINATIM_DELAY_MS = 1100; // Nominatim policy: max 1 request/second

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const args = parseGeocodeArgs(process.argv.slice(2));
  const googleKey = process.env.GOOGLE_MAPS_API_KEY || undefined;
  if (args.provider === 'google' && !googleKey) throw new Error('Falta GOOGLE_MAPS_API_KEY');

  const pool = await getPool();
  const rows = (await pool.request().query(`
    SELECT RTRIM(co_cli) AS coCli, RTRIM(cli_des) AS name,
           RTRIM(direc1) AS direc1, RTRIM(dir_ent2) AS dirEnt2, RTRIM(campo1) AS campo1
    FROM saCliente
    WHERE inactivo = 0 ${args.force ? '' : `AND NULLIF(RTRIM(campo1), '') IS NULL`}
    ORDER BY co_cli
  `)).recordset as { coCli: string; name: string; direc1: string | null; dirEnt2: string | null; campo1: string | null }[];

  const todo = args.limit ? rows.slice(0, args.limit) : rows;
  console.log(`${todo.length} cliente(s) a procesar — modo: ${args.apply ? 'APPLY' : 'dry-run'}, proveedor: ${args.provider}\n`);

  const ok: Record<string, string | number>[] = [];
  const manual: Record<string, string>[] = [];

  for (const row of todo) {
    const picked = pickAddress(row);
    if (!picked) { manual.push({ cliente: row.coCli, nombre: row.name, motivo: 'sin dirección' }); continue; }

    let result;
    try {
      result = await geocodeAddress(normalizeAddress(picked.address), { mode: args.provider, googleKey });
    } catch (err) {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: `error: ${(err as Error).message}` });
      await sleep(NOMINATIM_DELAY_MS);
      continue;
    }

    const c = result.candidate;
    if (!c) {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: result.rejected.length ? `descartado (${result.rejected.join(', ')})` : 'sin resultado' });
    } else if (c.confidence === 'low') {
      manual.push({ cliente: row.coCli, nombre: row.name, motivo: `confianza baja (${c.provider}: ${c.detail})` });
    } else {
      const campo1 = formatCoordinates({ lat: c.lat, lng: c.lng });
      ok.push({ cliente: row.coCli, nombre: row.name, dirección: `${picked.source}: ${picked.address}`, proveedor: c.provider, confianza: `${c.confidence} (${c.detail})`, campo1 });
      if (args.apply) await updateCustomerLocation(pool, { coCli: row.coCli, campo1 });
    }
    await sleep(NOMINATIM_DELAY_MS);
  }

  console.log(`\n✓ ${args.apply ? 'Escritos' : 'Escribiría'}: ${ok.length}`);
  if (ok.length) console.table(ok);
  console.log(`\n⚠ Requieren colocación manual en /mapa: ${manual.length}`);
  if (manual.length) console.table(manual);
  if (!args.apply && ok.length) console.log('\nDry-run: nada se escribió. Use --apply para guardar.');
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
