import { sqliteTable, integer, text, real, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  email:        text('email').notNull().unique(),
  name:         text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt:    integer('created_at').notNull(),                // unix ms; use Date.now() on insert
});

export type User    = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ── Inventory module ────────────────────────────────────────────────

export const userModules = sqliteTable('user_modules', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  module: text('module', { enum: ['inventory', 'dwh', 'pricing_view', 'pricing_edit', 'geo'] }).notNull(),
});

export type UserModule    = typeof userModules.$inferSelect;
export type NewUserModule = typeof userModules.$inferInsert;

export const inventoryWarehouses = sqliteTable('inventory_warehouses', {
  id:     integer('id').primaryKey({ autoIncrement: true }),
  coAlma: text('co_alma').notNull().unique(),   // matches Profit Plus saAlmacen.co_alma (char(6), untrimmed)
  label:  text('label').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
});

export type InventoryWarehouse    = typeof inventoryWarehouses.$inferSelect;
export type NewInventoryWarehouse = typeof inventoryWarehouses.$inferInsert;

export const inventorySettings = sqliteTable('inventory_settings', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  rollingWindowDays:    integer('rolling_window_days').notNull().default(60),
  daysOfStockThreshold: integer('days_of_stock_threshold').notNull().default(7),
});

export type InventorySettings    = typeof inventorySettings.$inferSelect;
export type NewInventorySettings = typeof inventorySettings.$inferInsert;

// ── Invoice reminders ───────────────────────────────────────────────

export const invoiceReminderSettings = sqliteTable('invoice_reminder_settings', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  thresholdDays: integer('threshold_days').notNull().default(3),
});

export type InvoiceReminderSettings    = typeof invoiceReminderSettings.$inferSelect;
export type NewInvoiceReminderSettings = typeof invoiceReminderSettings.$inferInsert;

export const invoiceReminderLog = sqliteTable('invoice_reminder_log', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  runDate:      text('run_date').notNull(),
  coCli:        text('co_cli').notNull(),
  email:        text('email').notNull(),
  invoiceCount: integer('invoice_count').notNull(),
  status:       text('status', { enum: ['sent', 'failed'] }).notNull(),
  errorMessage: text('error_message'),
  sentAt:       integer('sent_at').notNull(),
});

export type InvoiceReminderLog    = typeof invoiceReminderLog.$inferSelect;
export type NewInvoiceReminderLog = typeof invoiceReminderLog.$inferInsert;

// ── Visit cadence targets ───────────────────────────────────────────
// Manual per-customer/segment expected purchase-gap targets, used by the
// Cadencia tab to flag overdue customers. No cadence/frequency concept
// exists anywhere in Profit Plus (confirmed during spec design), so this
// is entered manually — see docs/superpowers/specs/
// 2026-09-21-active-customer-visit-cadence-design.md. A row with
// legalEntityKey set overrides any segment-level default for that entity; a
// row with legalEntityKey NULL and segmentCode set is a fallback for every
// entity in that segment without its own override.

export const visitCadenceTargets = sqliteTable('visit_cadence_targets', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  legalEntityKey: integer('legal_entity_key'),                             // null = segment-level default
  segmentCode:    text('segment_code', { enum: ['CADENA', 'INDEPENDIENTES'] }),
  targetGapDays:  integer('target_gap_days').notNull(),
});

export type VisitCadenceTarget    = typeof visitCadenceTargets.$inferSelect;
export type NewVisitCadenceTarget = typeof visitCadenceTargets.$inferInsert;

// ── Seller 360° targets ─────────────────────────────────────────────
// Manual per-seller monthly quotas (sales, weekly visit reach, new
// customers), used by the Seller 360° profile drill-down (reached from the
// Vendedores tab). One row per seller per month; all three quota columns
// are independently nullable — a seller can have a sales quota set without
// a visit quota yet defined. No segment-level default/fallback row (unlike
// visitCadenceTargets) — the seller list is small and known (Dim_SalesRep),
// so a missing row for a given month means "no quota set," full stop. See
// docs/superpowers/specs/2026-09-27-seller-360-dashboard-design.md.

export const sellerTargets = sqliteTable('seller_targets', {
  id:               integer('id').primaryKey({ autoIncrement: true }),
  salesRepKey:      text('sales_rep_key').notNull(),
  periodMonth:      text('period_month').notNull(), // 'YYYY-MM'
  salesQuotaUsd:    real('sales_quota_usd'),
  weeklyVisitQuota: integer('weekly_visit_quota'),
  newCustomerQuota: integer('new_customer_quota'),
}, (t) => ({
  uniq: unique('seller_targets_rep_month_unique').on(t.salesRepKey, t.periodMonth),
}));

export type SellerTarget    = typeof sellerTargets.$inferSelect;
export type NewSellerTarget = typeof sellerTargets.$inferInsert;

export const qrCodes = sqliteTable('qr_codes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  userId:    integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  content:   text('content').notNull(),
  logoMode:  text('logo_mode', { enum: ['default', 'custom', 'none'] }).notNull().default('default'),
  logoPath:  text('logo_path'),                       // filename inside data/qr-logos/; set only when logoMode = 'custom'
  fgColor:   text('fg_color').notNull().default('#000000'),
  createdAt: integer('created_at').notNull(),         // unix ms
  updatedAt: integer('updated_at').notNull(),         // unix ms
});

export type QrCode    = typeof qrCodes.$inferSelect;
export type NewQrCode = typeof qrCodes.$inferInsert;

export const routes = sqliteTable('routes', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  name:       text('name').notNull(),
  sellerCode: text('seller_code').notNull(),          // saVendedor.co_ven, trimmed
  createdAt:  integer('created_at').notNull(),        // unix ms
}, (t) => ({
  uniq: unique('routes_seller_name_unique').on(t.sellerCode, t.name),
}));

export type Route    = typeof routes.$inferSelect;
export type NewRoute = typeof routes.$inferInsert;

export const routeCustomers = sqliteTable('route_customers', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  routeId:      integer('route_id').notNull().references(() => routes.id, { onDelete: 'cascade' }),
  customerCode: text('customer_code').notNull(),      // saCliente.co_cli, trimmed
}, (t) => ({
  uniq: unique('route_customers_route_customer_unique').on(t.routeId, t.customerCode),
}));

export type RouteCustomer    = typeof routeCustomers.$inferSelect;
export type NewRouteCustomer = typeof routeCustomers.$inferInsert;

export const salesAreas = sqliteTable('sales_areas', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull().unique(),
  color:     text('color').notNull(),                  // '#RRGGBB'
  polygon:   text('polygon').notNull(),                // GeoJSON Polygon text, [lng, lat], closed ring
  createdAt: integer('created_at').notNull(),          // unix ms
});

export type SalesArea    = typeof salesAreas.$inferSelect;
export type NewSalesArea = typeof salesAreas.$inferInsert;

export const salesAreaSellers = sqliteTable('sales_area_sellers', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  areaId:     integer('area_id').notNull().references(() => salesAreas.id, { onDelete: 'cascade' }),
  sellerCode: text('seller_code').notNull(),           // saVendedor.co_ven, trimmed
}, (t) => ({
  uniq: unique('sales_area_sellers_area_seller_unique').on(t.areaId, t.sellerCode),
}));

export type SalesAreaSeller    = typeof salesAreaSellers.$inferSelect;
export type NewSalesAreaSeller = typeof salesAreaSellers.$inferInsert;

// ── Pricing workspace ─────────────────────────────────────────────────────
// `action` is a TypeScript-only enum (no CHECK constraint): later pricing
// plans add values without a migration.
export const PRICING_AUDIT_ACTIONS = [
  'segment_create', 'segment_repoint', 'segment_rename', 'customer_move',
  'list_create', 'list_clone', 'rates_apply',
  'promotion_create', 'promotion_cancel', 'promotion_extend', 'sweep_revert',
] as const;
export type PricingAuditAction = typeof PRICING_AUDIT_ACTIONS[number];

export const pricingSegmentMeta = sqliteTable('pricing_segment_meta', {
  tipCli:         text('tip_cli').primaryKey(),                 // saTipoCliente.tip_cli, trimmed
  kind:           text('kind', { enum: ['group', 'special'] }).notNull(),
  customerCoCli:  text('customer_co_cli'),                      // special only
  reason:         text('reason'),
  expiresAt:      text('expires_at'),                           // YYYY-MM-DD
  fallbackTipCli: text('fallback_tip_cli'),
  previousTipCli: text('previous_tip_cli'),
  createdBy:      text('created_by').notNull(),                 // session.sub
  createdAt:      integer('created_at').notNull(),              // unix ms
});

export type SegmentMeta    = typeof pricingSegmentMeta.$inferSelect;
export type NewSegmentMeta = typeof pricingSegmentMeta.$inferInsert;

export const pricingAuditLog = sqliteTable('pricing_audit_log', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  at:         integer('at').notNull(),                          // unix ms
  userId:     text('user_id').notNull(),
  action:     text('action', { enum: PRICING_AUDIT_ACTIONS }).notNull(),
  target:     text('target').notNull(),                         // tip_cli, co_cli, co_precio or promotion id
  beforeJson: text('before_json'),
  afterJson:  text('after_json'),
});

export type PricingAuditRow = typeof pricingAuditLog.$inferSelect;

export const pricingListMeta = sqliteTable('pricing_list_meta', {
  coPrecio:  text('co_precio').primaryKey(),     // saTipoPrecio.co_precio, trimmed
  coMone:    text('co_mone').notNull(),          // currency chosen at creation (used until the list has rate rows)
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),    // unix ms
});
export type ListMeta = typeof pricingListMeta.$inferSelect;

// ── Pricing promotions ──────────────────────────────────────────────────
export const pricingPromotions = sqliteTable('pricing_promotions', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull(),
  reason:      text('reason'),
  kind:        text('kind', { enum: ['overlay', 'segment'] }).notNull(),
  coPrecio:    text('co_precio').notNull(),       // overlay: target list; segment: the promo list
  baseCoPrecio: text('base_co_precio'),           // segment only
  tipCli:      text('tip_cli'),                   // segment only: the special segment
  startsOn:    text('starts_on').notNull(),
  endsOn:      text('ends_on').notNull(),
  cancelledAt: integer('cancelled_at'),           // unix ms; null = not cancelled
  createdBy:   text('created_by').notNull(),
  createdAt:   integer('created_at').notNull(),
});
export type Promotion = typeof pricingPromotions.$inferSelect;

export const pricingPromotionItems = sqliteTable('pricing_promotion_items', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  promotionId:  integer('promotion_id').notNull().references(() => pricingPromotions.id, { onDelete: 'cascade' }),
  coArt:        text('co_art').notNull(),
  coAlma:       text('co_alma'),                  // warehouse used (null until applied)
  promoMonto:   real('promo_monto').notNull(),
  regularMonto: real('regular_monto'),            // regular price at creation (null if unknown/rejected)
  applied:      integer('applied').notNull().default(0), // 0/1
  message:      text('message'),                  // failure/skip reason
}, t => ({ uniq: unique('pricing_promotion_items_uniq').on(t.promotionId, t.coArt) }));
export type PromotionItem = typeof pricingPromotionItems.$inferSelect;

export const pricingPromotionCustomers = sqliteTable('pricing_promotion_customers', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  promotionId:    integer('promotion_id').notNull().references(() => pricingPromotions.id, { onDelete: 'cascade' }),
  coCli:          text('co_cli').notNull(),
  previousTipCli: text('previous_tip_cli').notNull(),
  moved:          integer('moved').notNull().default(0),
}, t => ({ uniq: unique('pricing_promotion_customers_uniq').on(t.promotionId, t.coCli) }));
export type PromotionCustomer = typeof pricingPromotionCustomers.$inferSelect;
