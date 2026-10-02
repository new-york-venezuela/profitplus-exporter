// Type-only; safe to import from client components (no runtime server imports).
import type { CustomerDto } from './customers-query';

export type { SegmentDto, SegmentMoveResult } from './segments-service';
export type { CustomerDto } from './customers-query';
export interface CustomerPage { customers: CustomerDto[]; total: number; page: number; pageSize: number }
export interface PriceListDto { coPrecio: string; desPrecio: string; assignedCustomerCount: number }
export interface FilterOption { value: string; label: string }
