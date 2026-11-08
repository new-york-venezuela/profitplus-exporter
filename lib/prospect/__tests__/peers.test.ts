import { describe, expect, test } from 'bun:test';
import { selectPeers, MIN_PEERS, type PeerCandidate } from '../peers';

let n = 0;
function cand(over: Partial<PeerCandidate>): PeerCandidate {
  n += 1;
  return {
    code: `C${n}`, name: `Cliente ${n}`, typeCode: 'T1', routeNumber: 1,
    point: null, weeklyUnits: 10, ...over,
  };
}
const at = (lat: number, lng: number) => ({ lat, lng });

describe('selectPeers', () => {
  test('MIN_PEERS is 5', () => expect(MIN_PEERS).toBe(5));

  test('5 same type and route -> type_route', () => {
    const cs = Array.from({ length: 5 }, () => cand({}));
    const r = selectPeers(cs, { typeCode: 'T1', routeNumber: 1, pin: null });
    expect(r.tier).toBe('type_route');
    expect(r.peers).toHaveLength(5);
  });

  test('4 on route + 2 on a near route -> type_near_routes; far routes excluded', () => {
    const own = Array.from({ length: 4 }, () => cand({ routeNumber: 1, point: at(10, -66) }));
    const near = Array.from({ length: 2 }, () => cand({ routeNumber: 2, point: at(10.01, -66) }));
    const near2 = cand({ routeNumber: 3, point: at(10.02, -66) });
    const far = cand({ routeNumber: 4, point: at(8, -62) });
    const r = selectPeers([...own, ...near, near2, far], {
      typeCode: 'T1', routeNumber: 1, pin: at(10, -66),
    });
    expect(r.tier).toBe('type_near_routes');
    const codes = r.peers.map((p) => p.code);
    for (const p of near) expect(codes).toContain(p.code);
    expect(codes).toContain(near2.code);
    expect(codes).not.toContain(far.code);
    expect(r.peers).toHaveLength(7);
  });

  test('fewer than 5 everywhere -> type_all with all same-type, other types never appear', () => {
    const a = cand({ routeNumber: 1, point: at(10, -66) });
    const b = cand({ routeNumber: 2, point: at(10.01, -66) });
    const c = cand({ routeNumber: 9, point: at(8, -62) });
    const other = cand({ typeCode: 'T2', routeNumber: 1 });
    const r = selectPeers([a, b, c, other], { typeCode: 'T1', routeNumber: 1, pin: null });
    expect(r.tier).toBe('type_all');
    expect(r.peers.map((p) => p.code).sort()).toEqual([a.code, b.code, c.code].sort());
  });

  test('zero candidates -> type_all, empty', () => {
    expect(selectPeers([], { typeCode: 'T1', routeNumber: 1, pin: null }))
      .toEqual({ tier: 'type_all', peers: [] });
  });

  test('with a pin, same route first, then distance, no-point last', () => {
    const noPoint = cand({ routeNumber: 1, point: null });
    const ownFar = cand({ routeNumber: 1, point: at(10.5, -66) });
    const ownNear = cand({ routeNumber: 1, point: at(10.1, -66) });
    const other = cand({ routeNumber: 2, point: at(10.0, -66) });
    const more = Array.from({ length: 2 }, () => cand({ routeNumber: 2, point: at(10.2, -66) }));
    const r = selectPeers([noPoint, other, ownFar, ...more, ownNear], {
      typeCode: 'T1', routeNumber: 1, pin: at(10, -66),
    });
    expect(r.tier).toBe('type_near_routes');
    expect(r.peers.slice(0, 3).map((p) => p.code)).toEqual([ownNear.code, ownFar.code, noPoint.code]);
    expect(r.peers[3].code).toBe(other.code);
    expect(r.peers[r.peers.length - 1].routeNumber).toBe(2);
  });

  test('no pin orders by weeklyUnits descending', () => {
    const cs = [3, 9, 5, 7, 1].map((u) => cand({ weeklyUnits: u }));
    const r = selectPeers(cs, { typeCode: 'T1', routeNumber: 1, pin: null });
    expect(r.peers.map((p) => p.weeklyUnits)).toEqual([9, 7, 5, 3, 1]);
  });
});
