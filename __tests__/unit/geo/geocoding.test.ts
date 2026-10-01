import { describe, test, expect } from 'bun:test';
import {
  GoogleFatalError, normalizeAddress, geocodeNominatim, geocodeGoogle, geocodeAddress,
} from '@/lib/geo/geocoding';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function fakeFetch(handler: (url: string, init?: RequestInit) => Response) {
  const calls: string[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

describe('normalizeAddress', () => {
  test('collapses whitespace, expands abbreviations, appends Venezuela once', () => {
    expect(normalizeAddress('  Av.  Francisco  de Miranda,   C.C. Lido  ')).toBe(
      'Avenida Francisco de Miranda, Centro Comercial Lido, Venezuela',
    );
    expect(normalizeAddress('Calle 5, Venezuela')).toBe('Calle 5, Venezuela');
  });
  test('empty after trimming returns empty string', () => {
    expect(normalizeAddress('   ')).toBe('');
  });
});

describe('geocodeNominatim', () => {
  test('maps the first hit; sends a User-Agent and restricts to VE', async () => {
    const { impl, calls } = fakeFetch((_u, init) => {
      expect((init?.headers as Record<string, string>)['User-Agent']).toContain('profitplus-exporter');
      return json([{ lat: '10.4806', lon: '-66.9036', importance: 0.5, display_name: 'Caracas' }]);
    });
    const c = await geocodeNominatim('Caracas, Venezuela', impl);
    expect(c).toEqual({ lat: 10.4806, lng: -66.9036, provider: 'osm', confidence: 'high', detail: 'importance 0.50' });
    expect(calls[0]).toContain('countrycodes=ve');
  });
  test('importance buckets: <0.25 low, <0.4 medium', async () => {
    const mk = (imp: number) => fakeFetch(() => json([{ lat: '10', lon: '-66', importance: imp, display_name: 'x' }])).impl;
    expect((await geocodeNominatim('a', mk(0.1)))!.confidence).toBe('low');
    expect((await geocodeNominatim('a', mk(0.3)))!.confidence).toBe('medium');
  });
  test('empty array → null', async () => {
    expect(await geocodeNominatim('x', fakeFetch(() => json([])).impl)).toBeNull();
  });
  test('HTTP error throws', async () => {
    await expect(geocodeNominatim('x', fakeFetch(() => json({}, 429)).impl)).rejects.toThrow('Nominatim');
  });
});

describe('geocodeGoogle', () => {
  test('maps location + location_type to confidence', async () => {
    const mk = (t: string) => fakeFetch(() => json({
      status: 'OK', results: [{ geometry: { location: { lat: 10.5, lng: -66.9 }, location_type: t } }],
    })).impl;
    expect((await geocodeGoogle('a', 'KEY', mk('ROOFTOP')))).toMatchObject({ lat: 10.5, lng: -66.9, provider: 'google', confidence: 'high' });
    expect((await geocodeGoogle('a', 'KEY', mk('RANGE_INTERPOLATED')))!.confidence).toBe('medium');
    expect((await geocodeGoogle('a', 'KEY', mk('GEOMETRIC_CENTER')))!.confidence).toBe('medium');
    expect((await geocodeGoogle('a', 'KEY', mk('APPROXIMATE')))!.confidence).toBe('low');
  });
  test('ZERO_RESULTS → null', async () => {
    expect(await geocodeGoogle('a', 'K', fakeFetch(() => json({ status: 'ZERO_RESULTS', results: [] })).impl)).toBeNull();
  });
  test('REQUEST_DENIED / OVER_QUERY_LIMIT throw with the status (not "no result")', async () => {
    const denied = fakeFetch(() => json({ status: 'REQUEST_DENIED', error_message: 'bad key', results: [] })).impl;
    await expect(geocodeGoogle('a', 'K', denied)).rejects.toThrow('REQUEST_DENIED');
    const limit = fakeFetch(() => json({ status: 'OVER_QUERY_LIMIT', results: [] })).impl;
    await expect(geocodeGoogle('a', 'K', limit)).rejects.toThrow('OVER_QUERY_LIMIT');
  });
  test('the API key is sent but the address is URL-encoded', async () => {
    const { impl, calls } = fakeFetch(() => json({ status: 'ZERO_RESULTS', results: [] }));
    await geocodeGoogle('Av. Ñ & Co', 'KEY123', impl);
    expect(calls[0]).toContain('key=KEY123');
    expect(calls[0]).toContain(encodeURIComponent('Av. Ñ & Co'));
  });
});

describe('geocodeAddress', () => {
  const osm = (lat: string, lon: string, importance: number) =>
    [{ lat, lon, importance, display_name: 'x' }];

  test('both: a high-confidence OSM hit is returned without calling Google', async () => {
    const { impl, calls } = fakeFetch(() => json(osm('10.5', '-66.9', 0.6)));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.candidate?.provider).toBe('osm');
    expect(calls.some(u => u.includes('googleapis'))).toBe(false);
  });

  test('both: no OSM hit falls back to Google', async () => {
    const { impl } = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'OK', results: [{ geometry: { location: { lat: 10.5, lng: -66.9 }, location_type: 'ROOFTOP' } }] })
      : json([]));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.candidate?.provider).toBe('google');
  });

  test('both: low-confidence OSM is kept only if Google finds nothing better', async () => {
    const lowOsm = osm('10.5', '-66.9', 0.1);
    const g = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'OK', results: [{ geometry: { location: { lat: 10.6, lng: -66.8 }, location_type: 'ROOFTOP' } }] })
      : json(lowOsm));
    expect((await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: g.impl })).candidate?.provider).toBe('google');

    const none = fakeFetch(u => u.includes('googleapis') ? json({ status: 'ZERO_RESULTS', results: [] }) : json(lowOsm));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: none.impl });
    expect(r.candidate).toMatchObject({ provider: 'osm', confidence: 'low' });
  });

  test('both without a Google key behaves like osm', async () => {
    const { impl, calls } = fakeFetch(() => json([]));
    const r = await geocodeAddress('a', { mode: 'both', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(calls.length).toBe(1);
  });

  test('google mode without a key throws', async () => {
    await expect(geocodeAddress('a', { mode: 'google', fetchImpl: fakeFetch(() => json({})).impl })).rejects.toThrow('GOOGLE_MAPS_API_KEY');
  });

  test('a result outside Venezuela is rejected, recorded, and not returned', async () => {
    const { impl } = fakeFetch(() => json(osm('40.4', '-3.7', 0.7))); // Madrid
    const r = await geocodeAddress('a', { mode: 'osm', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(r.rejected).toEqual(['osm: OUT_OF_RANGE']);
  });

  test('a swapped provider result is rejected as SWAPPED_SUSPECTED, never auto-corrected', async () => {
    const { impl } = fakeFetch(() => json(osm('-66.9', '10.5', 0.7)));
    const r = await geocodeAddress('a', { mode: 'osm', fetchImpl: impl });
    expect(r.candidate).toBeNull();
    expect(r.rejected).toEqual(['osm: SWAPPED_SUSPECTED']);
  });

  test('both: Nominatim throwing is recorded and Google is still tried', async () => {
    const { impl } = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'OK', results: [{ geometry: { location: { lat: 10.5, lng: -66.9 }, location_type: 'ROOFTOP' } }] })
      : json({}, 503));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.candidate?.provider).toBe('google');
    expect(r.rejected[0]).toContain('osm: error');
  });

  test('both: Google REQUEST_DENIED is recorded and flagged googleFatal, OSM result kept', async () => {
    const { impl } = fakeFetch(u => u.includes('googleapis')
      ? json({ status: 'REQUEST_DENIED', results: [] })
      : json([{ lat: '10.5', lon: '-66.9', importance: 0.1, display_name: 'x' }]));
    const r = await geocodeAddress('a', { mode: 'both', googleKey: 'K', fetchImpl: impl });
    expect(r.googleFatal).toContain('REQUEST_DENIED');
    expect(r.candidate?.provider).toBe('osm');
  });

  test('geocodeGoogle throws GoogleFatalError on auth/quota status', async () => {
    const f = fakeFetch(() => json({ status: 'OVER_QUERY_LIMIT', results: [] })).impl;
    await expect(geocodeGoogle('a', 'K', f)).rejects.toBeInstanceOf(GoogleFatalError);
  });
});
