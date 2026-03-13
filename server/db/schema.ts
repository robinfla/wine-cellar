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

export const allocationStatusEnum = pgEnum('allocation_status', [
  'upcoming',
  'to_claim',
  'on_the_way',
  'received',
  'cancelled',
])

export const criticEnum = pgEnum('critic', [
  'robert_parker',
  'wine_spectator',
  'james_suckling',
  'decanter',
  'jancis_robinson',
  'wine_enthusiast',
  'vinous',
  'other',
])

export const wishlistItemTypeEnum = pgEnum('wishlist_item_type', [
  'wine',
  'producer',
])

export const valuationStatusEnum = pgEnum('valuation_status', [
  'pending',      // Not yet fetched
  'matched',      // Auto-matched with high confidence
  'needs_review', // Low confidence, user should verify
  'confirmed',    // User confirmed the match
  'no_match',     // Could not find a match
  'manual',       // User entered manually
])

// Users (must be defined before tables that reference it)
export const users = pgTable('users', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  isAdmin: boolean('is_admin').default(false).notNull(),
  preferredCurrency: currencyEnum('preferred_currency').default('EUR'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

// Cellars
export const cellars = pgTable('cellars', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  isVirtual: boolean('is_virtual').default(false).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueNameUser: unique().on(table.name, table.userId),
  userIdx: index('cellars_user_idx').on(table.userId),
}))

// Regions
export const regions = pgTable('regions', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  countryCode: text('country_code').notNull(),
  description: text('description'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  climate: text('climate'),
  soilTypes: text('soil_types'), // JSON array
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
  description: text('description'),
  originCountry: text('origin_country'),
  aliases: text('aliases'), // JSON array of alternative names
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Producers
export const producers = pgTable('producers', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  regionId: integer('region_id').references(() => regions.id),
  website: text('website'),
  notes: text('notes'),

  // Enrichment from scraped sources
  foundedYear: integer('founded_year'),
  description: text('description'),
  isOrganic: boolean('is_organic').default(false),
  isBiodynamic: boolean('is_biodynamic').default(false),
  isNatural: boolean('is_natural').default(false),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  dataSource: text('data_source'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueProducerRegionUser: unique().on(table.name, table.regionId, table.userId),
  nameIdx: index('producers_name_idx').on(table.name),
  userIdx: index('producers_user_idx').on(table.userId),
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
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  producerId: integer('producer_id').references(() => producers.id).notNull(),
  appellationId: integer('appellation_id').references(() => appellations.id),
  regionId: integer('region_id').references(() => regions.id),
  color: wineColorEnum('color').notNull(),

  // Default drinking window (years after vintage)
  defaultDrinkFromYears: integer('default_drink_from_years'),
  defaultDrinkUntilYears: integer('default_drink_until_years'),

  // Taste profile (generic tags)
  tasteProfile: text('taste_profile'), // JSON array: ["Bold", "Earthy", "Structured"]
  
  // Taste characteristics (0-100 scale for sliders)
  bodyWeight: integer('body_weight'), // 0 = Light, 100 = Heavy
  tanninLevel: integer('tannin_level'), // 0 = Flexible, 100 = Tannic
  sweetnessLevel: integer('sweetness_level'), // 0 = Dry, 100 = Sweet
  acidityLevel: integer('acidity_level'), // 0 = Soft, 100 = Acid
  
  // Serving guide
  servingTempCelsius: integer('serving_temp_celsius'), // e.g., 16
  decantMinutes: integer('decant_minutes'), // e.g., 60
  glassType: text('glass_type'), // e.g., "Bordeaux glass"
  
  // Food pairings
  foodPairings: text('food_pairings'), // JSON array: ["Grilled steak", "Aged cheese"]

  // Bottle image
  bottleImageUrl: text('bottle_image_url'), // URL to bottle photo

  // Style description (prose from Vivino/external sources)
  styleDescription: text('style_description'),

  // Certification flags
  isNatural: boolean('is_natural').default(false),
  isOrganic: boolean('is_organic').default(false),
  isBiodynamic: boolean('is_biodynamic').default(false),

  // Data provenance
  dataSource: text('data_source'), // 'vivino', 'invintory', 'manual'

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineProducerColorUser: unique().on(table.name, table.producerId, table.color, table.userId),
  nameIdx: index('wines_name_idx').on(table.name),
  producerIdx: index('wines_producer_idx').on(table.producerId),
  userIdx: index('wines_user_idx').on(table.userId),
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

// Vintages (first-class vintage data with aggregate ratings)
export const vintages = pgTable('vintages', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id, { onDelete: 'cascade' }).notNull(),
  year: integer('year'), // NULL = NV (non-vintage)

  // Aggregate community ratings (from Vivino, etc.)
  ratingsCount: integer('ratings_count'),
  ratingsAverage: decimal('ratings_average', { precision: 3, scale: 2 }),

  // Drink window for this specific vintage
  drinkFromYear: integer('drink_from_year'),
  drinkUntilYear: integer('drink_until_year'),
  drinkPeakYear: integer('drink_peak_year'),

  // Data provenance
  dataSource: text('data_source'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineVintage: unique().on(table.wineId, table.year),
  wineIdx: index('vintages_wine_idx').on(table.wineId),
  yearIdx: index('vintages_year_idx').on(table.year),
}))

// Food categories (normalized food types for pairings)
export const foodCategories = pgTable('food_categories', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull().unique(), // 'beef', 'lamb', etc.
  displayName: text('display_name').notNull(),
  category: text('category'), // 'meat', 'seafood', 'vegetarian', etc.
  imageUrl: text('image_url'),
})

// Wine-food pairing junction
export const wineFoodPairings = pgTable('wine_food_pairings', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id, { onDelete: 'cascade' }).notNull(),
  foodCategoryId: integer('food_category_id').references(() => foodCategories.id, { onDelete: 'cascade' }).notNull(),
  strength: decimal('strength', { precision: 3, scale: 2 }).default('1.0'), // 0-1 pairing strength
  dataSource: text('data_source'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineFood: unique().on(table.wineId, table.foodCategoryId),
  wineIdx: index('wine_food_wine_idx').on(table.wineId),
  foodIdx: index('wine_food_category_idx').on(table.foodCategoryId),
}))

// Inventory lots (actual bottles)
export const inventoryLots = pgTable('inventory_lots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  wineId: integer('wine_id').references(() => wines.id).notNull(),
  cellarId: integer('cellar_id').references(() => cellars.id).notNull(),
  formatId: integer('format_id').references(() => formats.id).notNull(),

  // Vintage reference (preferred - links to vintages table)
  vintageId: integer('vintage_id').references(() => vintages.id),
  // Legacy vintage field (kept for backward compatibility during migration)
  vintage: integer('vintage'), // DEPRECATED: use vintageId instead
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
  // NOTE: unique constraint still uses vintage for backward compat during migration
  // Will be updated to use vintageId in future migration
  uniqueLotUser: unique().on(table.wineId, table.cellarId, table.formatId, table.vintage, table.binLocation, table.userId),
  wineIdx: index('inventory_wine_idx').on(table.wineId),
  cellarIdx: index('inventory_cellar_idx').on(table.cellarId),
  vintageIdIdx: index('inventory_vintage_id_idx').on(table.vintageId),
  importHashIdx: index('inventory_import_hash_idx').on(table.importHash),
  userIdx: index('inventory_user_idx').on(table.userId),
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

// Tasting notes (per lot)
export const tastingNotes = pgTable('tasting_notes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  lotId: integer('lot_id').references(() => inventoryLots.id, { onDelete: 'cascade' }).notNull(),
  score: integer('score'),
  comment: text('comment'),
  pairing: text('pairing'),
  tastedAt: timestamp('tasted_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  lotIdx: index('tasting_notes_lot_idx').on(table.lotId),
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

// Invitations
export const invitations = pgTable('invitations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  code: text('code').notNull().unique(),
  email: text('email'),
  usedAt: timestamp('used_at'),
  usedByUserId: integer('used_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),
}, (table) => ({
  codeIdx: index('invitations_code_idx').on(table.code),
}))

// Allocations (yearly deals with producers)
export const allocations = pgTable('allocations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  producerId: integer('producer_id').references(() => producers.id).notNull(),
  year: integer('year').notNull(),

  // Lifecycle linking to previous year
  previousYearId: integer('previous_year_id').references((): any => allocations.id),

  // Claim window
  claimOpensAt: timestamp('claim_opens_at'),
  claimClosesAt: timestamp('claim_closes_at'),

  // Status
  status: allocationStatusEnum('status').default('upcoming').notNull(),
  notes: text('notes'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueProducerYearUser: unique().on(table.producerId, table.year, table.userId),
  producerIdx: index('allocations_producer_idx').on(table.producerId),
  yearIdx: index('allocations_year_idx').on(table.year),
  statusIdx: index('allocations_status_idx').on(table.status),
  userIdx: index('allocations_user_idx').on(table.userId),
}))

// Allocation items (wines within an allocation)
export const allocationItems = pgTable('allocation_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  allocationId: integer('allocation_id').references(() => allocations.id, { onDelete: 'cascade' }).notNull(),
  wineId: integer('wine_id').references(() => wines.id).notNull(),
  formatId: integer('format_id').references(() => formats.id).notNull(),
  vintage: integer('vintage'),

  // Quantities
  quantityAvailable: integer('quantity_available'),
  quantityClaimed: integer('quantity_claimed').default(0).notNull(),

  // Pricing
  pricePerBottle: decimal('price_per_bottle', { precision: 10, scale: 2 }),
  currency: currencyEnum('currency').default('EUR'),

  // Fulfillment
  quantityReceived: integer('quantity_received').default(0).notNull(),
  receivedAt: timestamp('received_at'),
  inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id),

  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueAllocationWine: unique().on(table.allocationId, table.wineId, table.formatId, table.vintage),
  allocationIdx: index('allocation_items_allocation_idx').on(table.allocationId),
  wineIdx: index('allocation_items_wine_idx').on(table.wineId),
}))

// Wine valuations (market prices from external sources)
export const wineValuations = pgTable('wine_valuations', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id, { onDelete: 'cascade' }).notNull(),
  vintage: integer('vintage'),

  priceEstimate: decimal('price_estimate', { precision: 10, scale: 2 }),
  priceLow: decimal('price_low', { precision: 10, scale: 2 }),
  priceHigh: decimal('price_high', { precision: 10, scale: 2 }),

  source: text('source'),
  sourceUrl: text('source_url'),
  sourceWineId: text('source_wine_id'),
  sourceName: text('source_name'),

  status: valuationStatusEnum('status').default('pending').notNull(),
  confidence: decimal('confidence', { precision: 3, scale: 2 }),
  rating: decimal('rating', { precision: 2, scale: 1 }),
  ratingsCount: integer('ratings_count'),

  fetchedAt: timestamp('fetched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineVintage: unique().on(table.wineId, table.vintage),
  wineIdx: index('valuations_wine_idx').on(table.wineId),
  statusIdx: index('valuations_status_idx').on(table.status),
}))

// Wine critic scores (external/manual ratings)
export const wineCriticScores = pgTable('wine_critic_scores', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  wineId: integer('wine_id').references(() => wines.id, { onDelete: 'cascade' }).notNull(),
  vintage: integer('vintage'),
  critic: criticEnum('critic').notNull(),
  score: integer('score').notNull(),
  note: text('note'),
  sourceUrl: text('source_url'),
  source: text('source').default('manual').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueWineVintageCritic: unique().on(table.wineId, table.vintage, table.critic),
  wineIdx: index('critic_scores_wine_idx').on(table.wineId),
}))

// Wishlist items (wines and producers to explore)
export const wishlistItems = pgTable('wishlist_items', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  userId: integer('user_id').references(() => users.id).notNull(),
  itemType: wishlistItemTypeEnum('item_type').notNull(),
  name: text('name').notNull(),
  wineId: integer('wine_id').references(() => wines.id, { onDelete: 'set null' }),
  producerId: integer('producer_id').references(() => producers.id, { onDelete: 'set null' }),
  regionId: integer('region_id').references(() => regions.id, { onDelete: 'set null' }),
  vintage: integer('vintage'),
  notes: text('notes'),
  winesOfInterest: text('wines_of_interest'),
  priceTarget: decimal('price_target', { precision: 10, scale: 2 }),
  priceCurrency: currencyEnum('price_currency').default('EUR'),
  url: text('url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('wishlist_user_idx').on(table.userId),
  itemTypeIdx: index('wishlist_item_type_idx').on(table.itemType),
}))

// Type exports for use throughout the app (only Select types - Insert types are inferred automatically)
export type Cellar = typeof cellars.$inferSelect
export type Region = typeof regions.$inferSelect
export type Appellation = typeof appellations.$inferSelect
export type Grape = typeof grapes.$inferSelect
export type Producer = typeof producers.$inferSelect
export type Format = typeof formats.$inferSelect
export type Wine = typeof wines.$inferSelect
export type WineGrape = typeof wineGrapes.$inferSelect
export type InventoryLot = typeof inventoryLots.$inferSelect
export type InventoryEvent = typeof inventoryEvents.$inferSelect
export type MaturityOverride = typeof maturityOverrides.$inferSelect
export type TastingNote = typeof tastingNotes.$inferSelect
export type FxRate = typeof fxRates.$inferSelect
export type User = typeof users.$inferSelect
export type Session = typeof sessions.$inferSelect
export type Invitation = typeof invitations.$inferSelect
export type Allocation = typeof allocations.$inferSelect
export type AllocationItem = typeof allocationItems.$inferSelect
export type WineValuation = typeof wineValuations.$inferSelect
export type WineCriticScore = typeof wineCriticScores.$inferSelect
export type WishlistItem = typeof wishlistItems.$inferSelect
export type Vintage = typeof vintages.$inferSelect
export type FoodCategory = typeof foodCategories.$inferSelect
export type WineFoodPairing = typeof wineFoodPairings.$inferSelect

// ─── Global Wine Reference (shared maturity data across all users) ───
export const wineReferences = pgTable('wine_references', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),

  // Canonical wine identity (normalized lowercase for matching)
  producerName: text('producer_name').notNull(),
  wineName: text('wine_name').notNull(),
  color: wineColorEnum('color').notNull(),
  region: text('region'),
  appellation: text('appellation'),
  grapes: text('grapes'),

  // AI-estimated drinking window (years after vintage)
  drinkFromYears: integer('drink_from_years').notNull(),
  drinkUntilYears: integer('drink_until_years').notNull(),
  confidence: text('confidence').notNull().default('medium'), // high, medium, low
  reasoning: text('reasoning'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueRef: unique().on(table.producerName, table.wineName, table.color),
  producerIdx: index('wine_ref_producer_idx').on(table.producerName),
  nameIdx: index('wine_ref_name_idx').on(table.wineName),
}))

export type WineReference = typeof wineReferences.$inferSelect

// ─── Cellar Spaces (rooms, fridges, cabinets) ───
export const cellarSpaces = pgTable('cellar_spaces', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  cellarId: integer('cellar_id').references(() => cellars.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(), // 'room' | 'fridge'
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  cellarIdx: index('spaces_cellar_idx').on(table.cellarId),
  userIdx: index('spaces_user_idx').on(table.userId),
}))

export type CellarSpace = typeof cellarSpaces.$inferSelect

// ─── Space Walls (only for room-type spaces) ───
export const spaceWalls = pgTable('space_walls', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  spaceId: integer('space_id').references(() => cellarSpaces.id, { onDelete: 'cascade' }).notNull(),
  position: text('position').notNull(), // 'left' | 'right' | 'back' | 'front' | 'floor'
}, (table) => ({
  spaceIdx: index('walls_space_idx').on(table.spaceId),
  uniqueWall: unique().on(table.spaceId, table.position),
}))

export type SpaceWall = typeof spaceWalls.$inferSelect

// ─── Cellar Racks ───
export const cellarRacks = pgTable('cellar_racks', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  spaceId: integer('space_id').references(() => cellarSpaces.id, { onDelete: 'cascade' }).notNull(),
  wallId: integer('wall_id').references(() => spaceWalls.id, { onDelete: 'set null' }),
  name: text('name'),
  type: text('type').notNull().default('grid'), // 'grid' | 'bin'
  columns: integer('columns').notNull(),
  rows: integer('rows').notNull(),
  depth: integer('depth').notNull().default(1),
  capacity: integer('capacity'), // per-bin capacity (bin type only)
  binLabels: text('bin_labels'), // JSON: {"row-col": "label"} for naming bins
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  spaceIdx: index('racks_space_idx').on(table.spaceId),
}))

export type CellarRack = typeof cellarRacks.$inferSelect

// ─── Rack Slots (1 slot = 1 bottle position) ───
export const rackSlots = pgTable('rack_slots', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  rackId: integer('rack_id').references(() => cellarRacks.id, { onDelete: 'cascade' }).notNull(),
  row: integer('row').notNull(),
  column: integer('column').notNull(),
  depthPosition: integer('depth_position').notNull().default(1),
  inventoryLotId: integer('inventory_lot_id').references(() => inventoryLots.id, { onDelete: 'set null' }),
}, (table) => ({
  rackIdx: index('slots_rack_idx').on(table.rackId),
  lotIdx: index('slots_lot_idx').on(table.inventoryLotId),
  uniqueSlot: unique().on(table.rackId, table.row, table.column, table.depthPosition),
}))

export type RackSlot = typeof rackSlots.$inferSelect

// ─── Bin Bottles (for bin-type racks: multiple bottles per bin) ───
