// Type-only; safe to import from client components (no runtime server imports).
import type { CustomerDto } from './customers-query';

export type { SegmentDto, SegmentMoveResult } from './segments-service';
export type { CustomerDto } from './customers-query';
export interface CustomerPage { customers: CustomerDto[]; total: number; page: number; pageSize: number }
export type { PriceListDto, GridRow, GridData, ApplyResult, ArticlePrices } from './lists-service';
export type { ArticleRow } from './rates-erp';
export interface FilterOption { value: string; label: string }
export type { PromotionDto, PromotionDetailDto, PreviewRow } from './promotions-service';
