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
  module: text('module', { enum: ['inventory', 'dwh', 'pricing_view', 'pricing_edit'] }).notNull(),
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
