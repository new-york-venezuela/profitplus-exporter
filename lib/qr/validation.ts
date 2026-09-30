export const MAX_CONTENT_BYTES = 1000;
export const MAX_LOGO_BYTES = 1_000_000;
const MAX_NAME_LENGTH = 100;

const SVG_PROLOG = /^\s*(?:<\?xml[^>]*\?>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>[]*(?:\[[\s\S]*?\])?\s*>\s*)*<svg[\s>]/i;

export type LogoKind = 'png' | 'jpg' | 'svg';
export type LogoMode = 'default' | 'custom' | 'none';

export function sniffLogo(bytes: Uint8Array): LogoKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  // Real-world SVGs (Illustrator, Inkscape) often open with an XML declaration, comments or a DOCTYPE.
  const head = new TextDecoder().decode(bytes.subarray(0, 4096));
  if (SVG_PROLOG.test(head)) return 'svg';
  return null;
}

export interface QrFields {
  name: string;
  content: string;
  logoMode: LogoMode;
  fgColor: string;
  logoFile: File | null;
}

export function parseQrFields(
  form: FormData,
): { ok: true; value: QrFields } | { ok: false; error: string } {
  const name = String(form.get('name') ?? '').trim();
  const content = String(form.get('content') ?? '').trim();
  const logoMode = String(form.get('logoMode') ?? 'default');
  const fgColor = String(form.get('fgColor') ?? '#000000');
  const file = form.get('logo');
  const logoFile = file instanceof File && file.size > 0 ? file : null;

  if (!name) return { ok: false, error: 'El nombre es obligatorio' };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres` };
  if (!content) return { ok: false, error: 'El contenido es obligatorio' };
  if (new TextEncoder().encode(content).length > MAX_CONTENT_BYTES) {
    return { ok: false, error: `El contenido no puede superar ${MAX_CONTENT_BYTES} bytes` };
  }
  if (!['default', 'custom', 'none'].includes(logoMode)) return { ok: false, error: 'Modo de logo inválido' };
  if (!/^#[0-9a-fA-F]{6}$/.test(fgColor)) return { ok: false, error: 'Color inválido' };
  if (logoFile && logoFile.size > MAX_LOGO_BYTES) return { ok: false, error: 'El logo no puede superar 1 MB' };

  return { ok: true, value: { name, content, logoMode: logoMode as LogoMode, fgColor, logoFile } };
}
