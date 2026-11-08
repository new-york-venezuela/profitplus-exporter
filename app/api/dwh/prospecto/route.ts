import { NextRequest, NextResponse } from 'next/server';
import { requireDwhAccess } from '@/lib/dwh/access';
import { getDwhPool } from '@/lib/db/dwh-mssql';
import { getPool } from '@/lib/db/mssql';
import { fetchErpCustomers } from '@/lib/geo/map-data';
import { parseCoordinates, validateCoordinates, coordinateErrorMessage, type LatLng } from '@/lib/geo/coordinates';
import { parseGrupo, parseRuta } from '@/lib/clientes/scope';
import { buildDateWhereClause, jsonWithCache } from '@/app/api/dwh/lib/query-builder';
import { DEFAULT_ROOT_SHARE_THRESHOLD, getFlaggedRootCodes } from '@/app/api/dwh/lib/consignment';
import { parseMargin } from '@/lib/prospect/benefit';
import { routeCentroids, suggestRoute } from '@/lib/prospect/geo';
import { selectPeers, type PeerCandidate } from '@/lib/prospect/peers';
import { buildResult, type ProductTotals } from '@/lib/prospect/aggregate';
import { prospectWindow, weeksActive } from '@/lib/prospect/window';
import { fetchProspectCustomers, fetchProspectProducts, type BaseCustomer, type ProductRow } from '@/lib/prospect/queries';
import { captureException } from '@/lib/analytics/posthog';

export const dynamic = 'force-dynamic';

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const isoOfKey = (k: number) => `${String(k).slice(0, 4)}-${String(k).slice(4, 6)}-${String(k).slice(6, 8)}`;

/** Both lat and lng absent -> null pin; one missing, non-numeric or outside Venezuela -> error message. */
function parsePin(sp: URLSearchParams): { pin: LatLng | null; error: string | null } {
  const rawLat = sp.get('lat');
  const rawLng = sp.get('lng');
  if (rawLat === null && rawLng === null) return { pin: null, error: null };
  if (!rawLat?.trim() || !rawLng?.trim()) return { pin: null, error: 'Indique latitud y longitud.' };
  const pin = { lat: Number(rawLat), lng: Number(rawLng) };
  if (!Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return { pin: null, error: 'Coordenadas inválidas.' };
  const v = validateCoordinates(pin);
  if (!v.ok) return { pin: null, error: coordinateErrorMessage(v.error) };
  return { pin, error: null };
}

function poolProducts(rows: ProductRow[], peerCodes: Set<string>): ProductTotals[] {
  const by = new Map<string, ProductTotals>();
  for (const r of rows) {
    if (!peerCodes.has(r.customerCode)) continue;
    const t = by.get(r.productCode) ?? { productCode: r.productCode, productName: r.productName, units: 0, usdNet: null, usdUnits: 0 };
    t.units += r.units;
    t.usdUnits += r.usdUnits;
    if (r.usdNet !== null) t.usdNet = (t.usdNet ?? 0) + r.usdNet;
    by.set(r.productCode, t);
  }
  return [...by.values()];
}

/** ERP coordinates are an enrichment: a failure degrades to no coordinates (no pin suggestion, peers by units). */
async function fetchErpCoordinates(): Promise<Awaited<ReturnType<typeof fetchErpCustomers>>> {
  try {
    return await fetchErpCustomers(await getPool());
  } catch (error) {
    console.error('GET /api/dwh/prospecto: ERP coordinates unavailable', error);
    captureException(error, 'prospecto-erp');
    return [];
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireDwhAccess(request);
  if (!auth.ok) return auth.response;

  const sp = new URL(request.url).searchParams;
  const section = sp.get('section');

  const { pin, error: pinError } = parsePin(sp);
  if (pinError) return bad(pinError);

  let tipo: string | null = null;
  let ruta: number | null = null;
  let margin: number | null = null;
  if (section !== 'options' && section !== 'suggest') {
    tipo = parseGrupo(sp.get('tipo'));
    if (tipo === null) return bad('Tipo de tienda inválido.');
    ruta = parseRuta(sp.get('ruta'));
    if (ruta === null) return bad('Ruta inválida.');
    margin = parseMargin(sp.get('margen'));
    if (margin === null) return bad('Margen inválido: use un porcentaje entre 0 y 99,9.');
  } else if (section === 'suggest' && !pin) {
    return bad('Indique latitud y longitud.');
  }

  try {
    const w = prospectWindow(new Date());
    const dateWhere = buildDateWhereClause(`custom:${isoOfKey(w.startKey)}:${isoOfKey(w.endKey)}`, 'fs');
    const full = section !== 'options' && section !== 'suggest';
    const dwh = await getDwhPool();
    const [customers, products, flaggedCodes, erp] = await Promise.all([
      fetchProspectCustomers(dwh, w),
      full ? fetchProspectProducts(dwh, w) : Promise.resolve([] as ProductRow[]),
      full ? getFlaggedRootCodes(dateWhere, DEFAULT_ROOT_SHARE_THRESHOLD) : Promise.resolve([] as string[]),
      section === 'options' ? Promise.resolve([] as Awaited<ReturnType<typeof fetchErpCoordinates>>) : fetchErpCoordinates(),
    ]);

    const flagged = new Set(flaggedCodes.map((c) => c.trim()));
    const points = new Map<string, LatLng>();
    for (const e of erp) {
      const p = parseCoordinates(e.campo1);
      if (p && validateCoordinates(p).ok) points.set(e.coCli.trim(), p);
    }

    const sellable = customers.filter((c: BaseCustomer) => c.units > 0 && !flagged.has(c.code));
    const excludedNoRoute = sellable.filter((c) => c.routeNumber === null).length;
    const routed = sellable.filter((c) => c.routeNumber !== null);
    const candidates: (PeerCandidate & { typeName: string | null })[] = routed
      .filter((c) => c.typeCode !== null)
      .map((c) => ({
        code: c.code,
        name: c.name,
        typeCode: c.typeCode as string,
        typeName: c.typeName,
        routeNumber: c.routeNumber,
        point: points.get(c.code) ?? null,
        weeklyUnits: c.units / weeksActive(c.firstKey ?? w.startKey, w.endKey),
      }));

    if (section === 'options') {
      const types = new Map<string, { code: string; name: string; count: number }>();
      for (const c of candidates) {
        const t = types.get(c.typeCode) ?? { code: c.typeCode, name: c.typeName ?? c.typeCode, count: 0 };
        t.count += 1;
        types.set(c.typeCode, t);
      }
      const routes = new Map<number, { number: number; name: string; customers: number }>();
      for (const c of routed) {
        const r = routes.get(c.routeNumber as number)
          ?? { number: c.routeNumber as number, name: c.routeName ?? `Ruta ${c.routeNumber}`, customers: 0 };
        r.customers += 1;
        routes.set(r.number, r);
      }
      return jsonWithCache({
        types: [...types.values()].sort((a, b) => a.name.localeCompare(b.name)),
        routes: [...routes.values()].sort((a, b) => a.number - b.number),
      });
    }

    const suggestedRoute = pin ? suggestRoute(pin, routed.map((c) => ({ routeNumber: c.routeNumber, point: points.get(c.code) ?? null }))) : null;
    if (section === 'suggest') return jsonWithCache({ route: suggestedRoute });

    const centroidsAll = routeCentroids(routed.map((c) => ({ routeNumber: c.routeNumber, point: points.get(c.code) ?? null })));
    const { tier, peers } = selectPeers(candidates, { typeCode: tipo as string, routeNumber: ruta as number, pin }, centroidsAll);
    const result = buildResult({
      tier,
      peers,
      products: poolProducts(products, new Set(peers.map((p) => p.code))),
      margin: margin as number,
      excludedNoRoute,
    });
    const typeNames = new Map(candidates.map((c) => [c.code, c.typeName]));
    return jsonWithCache({
      ...result,
      peers: result.peers.map((p) => ({ ...p, typeName: typeNames.get(p.code) ?? undefined })),
      suggestedRoute,
    });
  } catch (error) {
    console.error('GET /api/dwh/prospecto failed', error);
    captureException(error, auth.session.sub);
    return NextResponse.json({ error: 'Error al consultar el Data Warehouse' }, { status: 500 });
  }
}
