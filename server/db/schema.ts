import {
  pgTable,
  text,
  integer,
  timestamp,
  decimal,
  boolean,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core'

// Enums
export const wineColorEnum = pgEnum('wine_color', [
  'red',
  'white',
  'rose',
  'sparkling',
  'dessert',
  'fortified',
])

export const eventTypeEnum = pgEnum('event_type', [
  'purchase',
  'consume',
  'gift',
  'transfer',
  'adjustment',
  'loss',
])

export const currencyEnum = pgEnum('currency', ['EUR', 'USD', 'GBP', 'ZAR', 'CHF'])

export const maturityStatusEnum = pgEnum('maturity_status', [
  'too_early',
  'approaching',
  'ready',
  'peak',
  'declining',
  'past',
])

// Cellars
export const cellars = pgTable('cellars', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  countryCode: text('country_code').notNull(),
  isVirtual: boolean('is_virtual').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Regions
export const regions = pgTable('regions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueRegionCountry: unique().on(table.name, table.countryCode),
}))

// Appellations
export const appellations = pgTable('appellations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  regionId: integer('region_id').references(() => regions.id),
  level: text('level'), // AOC, Grand Cru, Premier Cru, etc.
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueAppellationRegion: unique().on(table.name, table.regionId),
}))

// Grapes
export const grapes = pgTable('grapes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  color: wineColorEnum('color'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Producers
export const producers = pgTable('producers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  regionId: integer('region_id').references(() => regions.id),
  website: text('website'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueProducerRegion: unique().on(table.name, table.regionId),
  nameIdx: index('producers_name_idx').on(table.name),
}))

// Bottle formats
export const formats = pgTable('formats', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(),
  volumeMl: integer('volume_ml').notNull(),
})

// Wines (catalog)
export const wines = pgTable('wines', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  producerId: integer('producer_id').references(() => producers.id).notNull(),
  appellationId: integer('appellation_id').references(() => appellations.id),
  color: wineColorEnum('color').notNull(),

  // Default drinking window (years after vintage)
  defaultDrinkFromYears: integer('default_drink_from_years'),
  defaultDrinkUntilYears: integer('default_drink_until_years'),

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineProducer: unique().on(table.name, table.producerId),
  nameIdx: index('wines_name_idx').on(table.name),
  producerIdx: index('wines_producer_idx').on(table.producerId),
}))

// Wine-grape junction
export const wineGrapes = pgTable('wine_grapes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id).notNull(),
  grapeId: integer('grape_id').references(() => grapes.id).notNull(),
  percentage: integer('percentage'),
}, (table) => ({
  uniqueWineGrape: unique().on(table.wineId, table.grapeId),
}))

// Inventory lots (actual bottles)
export const inventoryLots = pgTable('inventory_lots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id).notNull(),
  cellarId: integer('cellar_id').references(() => cellars.id).notNull(),
  formatId: integer('format_id').references(() => formats.id).notNull(),

  vintage: integer('vintage'), // null for NV
  quantity: integer('quantity').notNull().default(0),

  // Purchase info
  purchaseDate: timestamp('purchase_date'),
  purchasePricePerBottle: decimal('purchase_price_per_bottle', { precision: 10, scale: 2 }),
  purchaseCurrency: currencyEnum('purchase_currency').default('EUR'),
  purchaseSource: text('purchase_source'),

  // Location within cellar (optional)
  binLocation: text('bin_location'),

  // For idempotent imports
  importHash: text('import_hash'),

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueLot: unique().on(table.wineId, table.cellarId, table.formatId, table.vintage, table.binLocation),
  wineIdx: index('inventory_wine_idx').on(table.wineId),
  cellarIdx: index('inventory_cellar_idx').on(table.cellarId),
  importHashIdx: index('inventory_import_hash_idx').on(table.importHash),
}))

// Inventory events (audit trail)
export const inventoryEvents = pgTable('inventory_events', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lotId: integer('lot_id').references(() => inventoryLots.id).notNull(),
  eventType: eventTypeEnum('event_type').notNull(),
  quantityChange: integer('quantity_change').notNull(),

  // For transfers
  toCellarId: integer('to_cellar_id').references(() => cellars.id),

  // For consume events
  rating: integer('rating'),
  tastingNotes: text('tasting_notes'),

  eventDate: timestamp('event_date').notNull().defaultNow(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  lotIdx: index('events_lot_idx').on(table.lotId),
  dateIdx: index('events_date_idx').on(table.eventDate),
}))

// Maturity overrides
export const maturityOverrides = pgTable('maturity_overrides', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lotId: integer('lot_id').references(() => inventoryLots.id).notNull().unique(),
  drinkFromYear: integer('drink_from_year'),
  drinkUntilYear: integer('drink_until_year'),
  reason: text('reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Valuations (manual only for v1)
export const valuations = pgTable('valuations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id).notNull(),
  formatId: integer('format_id').references(() => formats.id).notNull(),
  valuationDate: timestamp('valuation_date').notNull(),
  pricePerBottle: decimal('price_per_bottle', { precision: 10, scale: 2 }).notNull(),
  currency: currencyEnum('currency').default('EUR'),
  source: text('source').default('manual'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  wineFormatDateIdx: index('valuations_wine_format_date_idx').on(
    table.wineId,
    table.formatId,
    table.valuationDate,
  ),
}))

// FX rates
export const fxRates = pgTable('fx_rates', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  fromCurrency: currencyEnum('from_currency').notNull(),
  toCurrency: currencyEnum('to_currency').notNull(),
  rate: decimal('rate', { precision: 12, scale: 6 }).notNull(),
  effectiveDate: timestamp('effective_date').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueFxRate: unique().on(table.fromCurrency, table.toCurrency, table.effectiveDate),
}))

// Users (single user for v1, but structured for potential expansion)
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  preferredCurrency: currencyEnum('preferred_currency').default('EUR'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Sessions
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('sessions_user_idx').on(table.userId),
  expiresIdx: index('sessions_expires_idx').on(table.expiresAt),
}))

// Type exports for use throughout the app
export type Cellar = typeof cellars.$inferSelect
export type NewCellar = typeof cellars.$inferInsert
export type Region = typeof regions.$inferSelect
export type NewRegion = typeof regions.$inferInsert
export type Appellation = typeof appellations.$inferSelect
export type NewAppellation = typeof appellations.$inferInsert
export type Grape = typeof grapes.$inferSelect
export type NewGrape = typeof grapes.$inferInsert
export type Producer = typeof producers.$inferSelect
export type NewProducer = typeof producers.$inferInsert
export type Format = typeof formats.$inferSelect
export type NewFormat = typeof formats.$inferInsert
export type Wine = typeof wines.$inferSelect
export type NewWine = typeof wines.$inferInsert
export type WineGrape = typeof wineGrapes.$inferSelect
export type NewWineGrape = typeof wineGrapes.$inferInsert
export type InventoryLot = typeof inventoryLots.$inferSelect
export type NewInventoryLot = typeof inventoryLots.$inferInsert
export type InventoryEvent = typeof inventoryEvents.$inferSelect
export type NewInventoryEvent = typeof inventoryEvents.$inferInsert
export type MaturityOverride = typeof maturityOverrides.$inferSelect
export type NewMaturityOverride = typeof maturityOverrides.$inferInsert
export type Valuation = typeof valuations.$inferSelect
export type NewValuation = typeof valuations.$inferInsert
export type FxRate = typeof fxRates.$inferSelect
export type NewFxRate = typeof fxRates.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
