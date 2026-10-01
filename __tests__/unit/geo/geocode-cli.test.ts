import { describe, test, expect } from 'bun:test';
import { parseGeocodeArgs, pickAddress } from '@/lib/geo/geocode-cli';

describe('parseGeocodeArgs', () => {
  test('defaults: dry-run, no force, provider both, no limit', () => {
    expect(parseGeocodeArgs([])).toEqual({ apply: false, force: false, provider: 'both', limit: null });
  });
  test('flags', () => {
    expect(parseGeocodeArgs(['--apply', '--force', '--provider', 'osm', '--limit', '5']))
      .toEqual({ apply: true, force: true, provider: 'osm', limit: 5 });
    expect(parseGeocodeArgs(['--provider=google'])).toMatchObject({ provider: 'google' });
  });
  test('rejects unknown flags and bad values', () => {
    expect(() => parseGeocodeArgs(['--wat'])).toThrow('--wat');
    expect(() => parseGeocodeArgs(['--provider', 'bing'])).toThrow('provider');
    expect(() => parseGeocodeArgs(['--limit', 'abc'])).toThrow('limit');
    expect(() => parseGeocodeArgs(['--limit', '0'])).toThrow('limit');
  });
});

describe('pickAddress', () => {
  test('prefers dir_ent2, falls back to direc1', () => {
    expect(pickAddress({ dirEnt2: 'Entrega 1', direc1: 'Fiscal 1' })).toEqual({ address: 'Entrega 1', source: 'dir_ent2' });
    expect(pickAddress({ dirEnt2: '   ', direc1: 'Fiscal 1' })).toEqual({ address: 'Fiscal 1', source: 'direc1' });
    expect(pickAddress({ dirEnt2: null, direc1: 'Fiscal 1' })).toEqual({ address: 'Fiscal 1', source: 'direc1' });
  });
  test('neither → null (so no provider call is made)', () => {
    expect(pickAddress({ dirEnt2: null, direc1: '  ' })).toBeNull();
    expect(pickAddress({ dirEnt2: null, direc1: null })).toBeNull();
  });
});
