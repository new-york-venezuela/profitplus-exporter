import type { QrCode } from '@/lib/db/schema';

export interface QrCodeDto {
  id: number;
  name: string;
  content: string;
  logoMode: QrCode['logoMode'];
  fgColor: string;
  createdAt: number;
  updatedAt: number;
}

export function toQrDto(row: QrCode): QrCodeDto {
  const { id, name, content, logoMode, fgColor, createdAt, updatedAt } = row;
  return { id, name, content, logoMode, fgColor, createdAt, updatedAt };
}
