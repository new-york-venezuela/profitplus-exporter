import QRCode from 'qrcode';

export const QUIET_ZONE = 4;
export const LOGO_AREA_RATIO = 0.15;
const LOGO_INSET = 0.08; // logo image is inset inside the white backing square

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const HREF_RE = /^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/;

export function qrMatrix(content: string) {
  const qr = QRCode.create(content, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  return { size, isDark: (row: number, col: number) => qr.modules.get(row, col) === 1 };
}

export function logoGeometry(moduleCount: number) {
  const side = moduleCount * Math.sqrt(LOGO_AREA_RATIO);
  const offset = QUIET_ZONE + (moduleCount - side) / 2;
  return { x: offset, y: offset, side };
}

export function buildQrSvg(opts: { content: string; fgColor: string; logoHref: string | null }): string {
  const { content, fgColor, logoHref } = opts;
  if (!COLOR_RE.test(fgColor)) throw new Error('Color inválido');
  if (logoHref !== null && !HREF_RE.test(logoHref)) throw new Error('Logo inválido');

  const { size, isDark } = qrMatrix(content);
  const total = size + 2 * QUIET_ZONE;

  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isDark(r, c)) d += `M${c + QUIET_ZONE} ${r + QUIET_ZONE}h1v1h-1z`;
    }
  }

  let logo = '';
  if (logoHref) {
    const g = logoGeometry(size);
    const pad = g.side * LOGO_INSET;
    logo =
      `<rect x="${g.x}" y="${g.y}" width="${g.side}" height="${g.side}" rx="${g.side * 0.12}" fill="#ffffff"/>` +
      `<image href="${logoHref}" x="${g.x + pad}" y="${g.y + pad}" width="${g.side - 2 * pad}" height="${g.side - 2 * pad}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${d}" fill="${fgColor}"/>` +
    logo +
    `</svg>`
  );
}
