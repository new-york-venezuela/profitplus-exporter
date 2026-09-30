import { describe, test, expect } from 'bun:test';
import jsQR from 'jsqr';
import { buildQrSvg, logoGeometry, qrMatrix, QUIET_ZONE } from '@/lib/qr/render';

const SCALE = 8;

// Rasterize the module matrix (what the SVG draws), optionally blanking the logo backing square.
function raster(content: string, withLogo: boolean) {
  const { size, isDark } = qrMatrix(content);
  const total = size + 2 * QUIET_ZONE;
  const px = total * SCALE;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  const g = logoGeometry(size);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const mx = x / SCALE, my = y / SCALE;
      const r = Math.floor(my) - QUIET_ZONE, c = Math.floor(mx) - QUIET_ZONE;
      const inLogo = withLogo && mx >= g.x && mx < g.x + g.side && my >= g.y && my < g.y + g.side;
      const dark = !inLogo && r >= 0 && c >= 0 && r < size && c < size && isDark(r, c);
      if (dark) { const i = (y * px + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
    }
  }
  return { data, px };
}

const samples = [
  'https://example.com',
  'Señor Ñandú ✓ 🚀',
  'https://alimentosnewyork.com/menu?utm_source=qr&utm_campaign=' + 'x'.repeat(300),
  'a'.repeat(1000),
];

describe('QR render', () => {
  for (const content of samples) {
    test(`decodes back with the logo area blanked: ${content.slice(0, 24)}…`, () => {
      const { data, px } = raster(content, true);
      const result = jsQR(data, px, px);
      expect(result?.data).toBe(content);
    });
  }

  test('logo backing square is centered and ~15% of the data area', () => {
    const size = 41;
    const g = logoGeometry(size);
    expect(g.x + g.side / 2).toBeCloseTo(QUIET_ZONE + size / 2, 5);
    expect(g.y + g.side / 2).toBeCloseTo(QUIET_ZONE + size / 2, 5);
    expect((g.side * g.side) / (size * size)).toBeCloseTo(0.15, 2);
  });

  test('buildQrSvg embeds the logo and color', () => {
    const svg = buildQrSvg({ content: 'hi', fgColor: '#112233', logoHref: 'data:image/png;base64,AAAA' });
    expect(svg).toContain('fill="#112233"');
    expect(svg).toContain('<image');
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
  });

  test('buildQrSvg without a logo has no <image>', () => {
    expect(buildQrSvg({ content: 'hi', fgColor: '#000000', logoHref: null })).not.toContain('<image');
  });

  test('buildQrSvg rejects injectable color and logo href', () => {
    expect(() => buildQrSvg({ content: 'hi', fgColor: '"><script>', logoHref: null })).toThrow();
    expect(() => buildQrSvg({ content: 'hi', fgColor: '#000000', logoHref: 'javascript:alert(1)' })).toThrow();
    expect(() => buildQrSvg({ content: 'hi', fgColor: '#000000', logoHref: 'data:image/png;base64,AA"onload="x' })).toThrow();
  });
});
