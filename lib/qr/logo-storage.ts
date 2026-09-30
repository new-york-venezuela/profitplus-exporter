import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import type { LogoKind } from './validation';

export function getLogoDir(): string {
  return process.env.QR_LOGO_DIR ?? path.resolve(process.env.SQLITE_PATH ?? './', 'data', 'qr-logos');
}

export async function saveLogo(bytes: Uint8Array, kind: LogoKind): Promise<string> {
  const dir = getLogoDir();
  await mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${kind}`;
  await writeFile(path.join(dir, filename), bytes);
  return filename;
}

// Filenames come from our own DB; basename() is belt-and-braces against a tampered row.
export async function readLogo(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(getLogoDir(), path.basename(filename)));
  } catch {
    return null;
  }
}

export async function deleteLogo(filename: string | null): Promise<void> {
  if (!filename) return;
  await unlink(path.join(getLogoDir(), path.basename(filename))).catch(() => {});
}
