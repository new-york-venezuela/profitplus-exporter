import { describe, test, expect } from 'bun:test';
import { sniffLogo } from '@/lib/qr/validation';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sniffLogo', () => {
  test('accepts SVGs that start with an XML declaration, a comment or a DOCTYPE', () => {
    const body = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>';
    expect(sniffLogo(enc(body))).toBe('svg');
    expect(sniffLogo(enc(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`))).toBe('svg');
    expect(sniffLogo(enc(`<!-- Generator: Adobe Illustrator 27 -->\n${body}`))).toBe('svg');
    expect(sniffLogo(enc(`<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n${body}`))).toBe('svg');
    expect(sniffLogo(enc(`﻿${body}`))).toBe('svg');
  });

  test('rejects html and text that merely mention <svg', () => {
    expect(sniffLogo(enc('<html><body>not a logo</body></html>'))).toBeNull();
    expect(sniffLogo(enc('hello <svg> world'))).toBeNull();
  });
});
