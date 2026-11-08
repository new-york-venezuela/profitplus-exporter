import { describe, expect, test } from 'bun:test';
import { buildMix, buildResult, quantile, type ProductTotals } from '../aggregate';
import type { PeerCandidate } from '../peers';

const prod = (code: string, units: number, usdNet: number | null, usdUnits = usdNet === null ? 0 : units): ProductTotals => ({
  productCode: code, productName: code, units, usdNet, usdUnits,
});
const peer = (code: string, weeklyUnits: number): PeerCandidate => ({
  code, name: code, typeCode: 'T', routeNumber: 1, point: null, weeklyUnits,
});

describe('quantile', () => {
  test('interpolates', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75);
    expect(quantile([5], 0.75)).toBe(5);
  });
  test('empty is null', () => expect(quantile([], 0.5)).toBeNull());
});

describe('buildMix', () => {
  test('shares sum to 1, top 8 plus otros', () => {
    const rows = Array.from({ length: 10 }, (_, i) => prod(`P${i}`, 100 - i * 5, (100 - i * 5) * 2));
    const mix = buildMix(rows);
    expect(mix).toHaveLength(9);
    expect(mix[8].productCode).toBe('OTROS');
    expect(mix.reduce((s, l) => s + l.share, 0)).toBeCloseTo(1);
    expect(mix[0].costUsd).toBeCloseTo(2);
    expect(mix[8].costUsd).toBeCloseTo(2);
  });
  test('null cost when no USD', () => {
    const mix = buildMix([prod('A', 10, null)]);
    expect(mix[0].costUsd).toBeNull();
    expect(mix[0].share).toBe(1);
  });
  test('otros cost is null when merged lines have no USD', () => {
    const rows = [...Array.from({ length: 8 }, (_, i) => prod(`P${i}`, 100, 100)), prod('X', 5, null)];
    const mix = buildMix(rows);
    expect(mix[8].costUsd).toBeNull();
  });
  test('empty rows give empty mix', () => expect(buildMix([])).toEqual([]));
});

describe('buildResult', () => {
  test('spec example: 10 units, cost 3.92, margin 30% -> 16.8', () => {
    const peers = [peer('a', 10), peer('b', 10), peer('c', 10)];
    const r = buildResult({
      tier: 'type_route', peers, products: [prod('P', 100, 392)], margin: 0.3, excludedNoRoute: 2,
    });
    expect(r.units).toEqual({ median: 10, p25: 10, p75: 10 });
    expect(r.benefit!.medianUsd).toBeCloseTo(16.8);
    expect(r.benefit!.incomplete).toBe(false);
    expect(r.lowPeers).toBe(true);
    expect(r.peerCount).toBe(3);
    expect(r.excludedNoRoute).toBe(2);
  });
  test('per-peer benefit uses own units and shared mix', () => {
    const r = buildResult({
      tier: 'type_route', peers: [peer('a', 10), peer('b', 20)], products: [prod('P', 100, 392)], margin: 0.3, excludedNoRoute: 0,
    });
    expect(r.peers.find((p) => p.code === 'a')!.weeklyBenefitUsd).toBeCloseTo(16.8);
    expect(r.peers.find((p) => p.code === 'b')!.weeklyBenefitUsd).toBeCloseTo(33.6);
  });
  test('per-peer benefit is null when the mix is entirely cost-less', () => {
    const r = buildResult({
      tier: 'type_all', peers: [peer('a', 10)], products: [prod('P', 100, null)], margin: 0.3, excludedNoRoute: 0,
    });
    expect(r.peers[0].weeklyBenefitUsd).toBeNull();
    expect(r.benefit!.incomplete).toBe(true);
  });
  test('empty peers', () => {
    const r = buildResult({ tier: 'type_all', peers: [], products: [], margin: 0.3, excludedNoRoute: 0 });
    expect(r.units).toBeNull();
    expect(r.benefit).toBeNull();
    expect(r.mix).toEqual([]);
    expect(r.peers).toEqual([]);
    expect(r.lowPeers).toBe(true);
  });
  test('a null-cost product marks incomplete and sums the rest', () => {
    const r = buildResult({
      tier: 'type_route', peers: Array.from({ length: 5 }, (_, i) => peer(`p${i}`, 10)),
      products: [prod('A', 50, 196), prod('B', 50, null)], margin: 0.3, excludedNoRoute: 0,
    });
    expect(r.lowPeers).toBe(false);
    expect(r.benefit!.incomplete).toBe(true);
    expect(r.benefit!.medianUsd).toBeCloseTo(8.4);
  });
});
