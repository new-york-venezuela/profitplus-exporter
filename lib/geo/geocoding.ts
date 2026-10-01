// lib/geo/geocoding.ts
import { validateCoordinates } from './coordinates';

export type Provider = 'osm' | 'google';
export type ProviderMode = Provider | 'both';
export type Confidence = 'high' | 'medium' | 'low';

export interface GeocodeCandidate {
  lat: number;
  lng: number;
  provider: Provider;
  confidence: Confidence;
  detail: string;
}

export interface GeocodeResult {
  candidate: GeocodeCandidate | null;
  rejected: string[];
  /** Set when Google returned an auth/quota error: callers should stop calling Google. */
  googleFatal?: string;
}

/** Google auth/quota failure (REQUEST_DENIED / OVER_QUERY_LIMIT): retrying is pointless. */
export class GoogleFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleFatalError';
  }
}

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bav\.?(?=\s)/gi, 'Avenida'],
  [/\bc\.c\.?(?=\s|$)/gi, 'Centro Comercial'],
  [/\burb\.?(?=\s)/gi, 'Urbanización'],
  [/\bedif\.?(?=\s)/gi, 'Edificio'],
];

export function normalizeAddress(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  if (!s) return '';
  for (const [re, full] of ABBREVIATIONS) s = s.replace(re, full);
  if (!/venezuela\s*$/i.test(s)) s = `${s}, Venezuela`;
  return s;
}

const USER_AGENT = 'profitplus-exporter/1.0 (customer geocoding script)';

export async function geocodeNominatim(address: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeCandidate | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ve&q=${encodeURIComponent(address)}`;
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const body = (await res.json()) as { lat: string; lon: string; importance?: number }[];
  const hit = body[0];
  if (!hit) return null;
  const importance = hit.importance ?? 0;
  const confidence: Confidence = importance < 0.25 ? 'low' : importance < 0.4 ? 'medium' : 'high';
  return { lat: Number(hit.lat), lng: Number(hit.lon), provider: 'osm', confidence, detail: `importance ${importance.toFixed(2)}` };
}

const GOOGLE_CONFIDENCE: Record<string, Confidence> = {
  ROOFTOP: 'high', RANGE_INTERPOLATED: 'medium', GEOMETRIC_CENTER: 'medium', APPROXIMATE: 'low',
};

export async function geocodeGoogle(address: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<GeocodeCandidate | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&components=country:VE&key=${apiKey}`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const body = (await res.json()) as {
    status: string; error_message?: string;
    results: { geometry: { location: { lat: number; lng: number }; location_type: string } }[];
  };
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status === 'REQUEST_DENIED' || body.status === 'OVER_QUERY_LIMIT' || body.status === 'OVER_DAILY_LIMIT') {
    throw new GoogleFatalError(`Google ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`);
  }
  if (body.status !== 'OK') throw new Error(`Google ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`);
  const g = body.results[0]?.geometry;
  if (!g) return null;
  return {
    lat: g.location.lat, lng: g.location.lng, provider: 'google',
    confidence: GOOGLE_CONFIDENCE[g.location_type] ?? 'low', detail: g.location_type,
  };
}

export async function geocodeAddress(
  address: string,
  opts: { mode: ProviderMode; googleKey?: string; fetchImpl?: typeof fetch },
): Promise<GeocodeResult> {
  const { mode, googleKey, fetchImpl } = opts;
  if (mode === 'google' && !googleKey) throw new Error('GOOGLE_MAPS_API_KEY requerido para --provider google');

  const attempts: Provider[] =
    mode === 'osm' ? ['osm'] : mode === 'google' ? ['google'] : googleKey ? ['osm', 'google'] : ['osm'];

  const rejected: string[] = [];
  let best: GeocodeCandidate | null = null;
  let googleFatal: string | undefined;

  for (const provider of attempts) {
    let c: GeocodeCandidate | null;
    try {
      c = provider === 'osm'
        ? await geocodeNominatim(address, fetchImpl)
        : await geocodeGoogle(address, googleKey!, fetchImpl);
    } catch (err) {
      // Single-provider mode: nothing to fall back to, surface the error.
      if (attempts.length === 1) throw err;
      rejected.push(`${provider}: error ${(err as Error).message}`);
      if (err instanceof GoogleFatalError) googleFatal = err.message;
      continue;
    }
    if (!c) continue;
    const v = validateCoordinates({ lat: c.lat, lng: c.lng });
    if (!v.ok) { rejected.push(`${provider}: ${v.error}`); continue; }
    if (c.confidence !== 'low') return { candidate: c, rejected };
    best ??= c;
  }
  return googleFatal ? { candidate: best, rejected, googleFatal } : { candidate: best, rejected };
}
