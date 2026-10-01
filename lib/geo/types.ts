import type { CoordinateError } from './coordinates';
import type { AreaDto } from './areas-repo';

export type Pareto = 'A' | 'B' | 'C';

// Same thresholds as app/api/dwh/clientes/route.ts (PARETO_THRESHOLDS).
export const PARETO_THRESHOLDS = { a: 0.2, b: 0.5 } as const;

export interface RouteDto {
  id: number;
  name: string;
  sellerCode: string;
  customerCodes: string[];
}

export interface MapCustomer {
  coCli: string;
  name: string;
  rif: string | null;
  coVen: string;
  sellerName: string | null;
  direc1: string | null;
  dirEnt2: string | null;
  lat: number | null;
  lng: number | null;
  /** Why this customer has no pin although campo1 is non-empty. */
  coordinatesIssue: CoordinateError | 'UNPARSEABLE' | null;
  revenueBs: number;
  revenueUsd: number | null;
  pareto: Pareto | null;
  routeIds: number[];
  areaId: number | null;
  areaName: string | null;
  areaSellerCodes: string[];
  /** Inside an area that has sellers, but the customer's own seller (coVen) is not one of them. */
  sellerMismatch: boolean;
}

export interface MapSeller { code: string; name: string }

export interface MapPayload {
  dateRange: string;
  customers: MapCustomer[];
  sellers: MapSeller[];
  routes: RouteDto[];
  areas: AreaDto[];
  paretoThresholds: typeof PARETO_THRESHOLDS;
}
