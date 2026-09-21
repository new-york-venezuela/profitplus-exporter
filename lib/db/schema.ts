import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

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
  module: text('module', { enum: ['inventory', 'dwh', 'recipes'] }).notNull(),
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

// ── Recipes / product costing module ───────────────────────────────

export const recipes = sqliteTable('recipes', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  coArt:     text('co_art').notNull().unique(),   // finished-good article this recipe produces (Profit Plus saArticulo.co_art)
  label:     text('label').notNull(),              // denormalized art_des snapshot, avoids a live ERP join on every list render
  active:    integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Recipe    = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export const recipeLines = sqliteTable('recipe_lines', {
  id:                integer('id').primaryKey({ autoIncrement: true }),
  recipeId:          integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  lineType:          text('line_type', { enum: ['erp_article', 'manual'] }).notNull(),
  coArt:             text('co_art'),                // set iff lineType === 'erp_article'
  manualLabel:       text('manual_label'),           // set iff lineType === 'manual', e.g. "Agua"
  quantity:          real('quantity').notNull(),     // amount of this ingredient per 1 unit of the recipe's finished good
  unit:              text('unit').notNull(),         // free-text display label (KG, LTS, UNID, ...) — no conversion engine in v1
  manualUnitCostUsd: real('manual_unit_cost_usd'),    // set iff lineType === 'manual'; USD cost per `unit`, defaults to 0 until the user sets a real figure
  sortOrder:         integer('sort_order').notNull().default(0),
});

export type RecipeLine    = typeof recipeLines.$inferSelect;
export type NewRecipeLine = typeof recipeLines.$inferInsert;
