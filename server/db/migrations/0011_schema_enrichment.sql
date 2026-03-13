-- Migration 0011: Schema enrichment + Vintages as first-class entities
-- BREAKING CHANGE: inventory_lots.vintage → vintage_id (FK to vintages table)

-- ============================================================================
-- 1. VINTAGES TABLE (first-class entity between wines and lots)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "vintages" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "wine_id" integer NOT NULL REFERENCES "wines"("id") ON DELETE CASCADE,
    "year" integer,  -- NULL = NV (non-vintage)
    
    -- Aggregate community ratings (from Vivino, etc.)
    "ratings_count" integer,
    "ratings_average" decimal(3, 2),  -- e.g., 4.25
    
    -- Drink window for this specific vintage
    "drink_from_year" integer,
    "drink_until_year" integer,
    "drink_peak_year" integer,
    
    -- Metadata
    "data_source" text,  -- 'vivino', 'invintory', 'manual'
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    
    CONSTRAINT "vintages_wine_year_unique" UNIQUE ("wine_id", "year")
);

CREATE INDEX IF NOT EXISTS "vintages_wine_idx" ON "vintages" ("wine_id");
CREATE INDEX IF NOT EXISTS "vintages_year_idx" ON "vintages" ("year");
CREATE INDEX IF NOT EXISTS "vintages_ratings_idx" ON "vintages" ("ratings_average") WHERE "ratings_average" IS NOT NULL;

-- ============================================================================
-- 2. MIGRATE EXISTING INVENTORY LOTS → CREATE VINTAGE RECORDS
-- ============================================================================

-- Create vintage records for each unique (wine_id, vintage) combination
INSERT INTO "vintages" ("wine_id", "year")
SELECT DISTINCT "wine_id", "vintage"
FROM "inventory_lots"
WHERE NOT EXISTS (
    SELECT 1 FROM "vintages" v 
    WHERE v."wine_id" = "inventory_lots"."wine_id" 
    AND (v."year" = "inventory_lots"."vintage" OR (v."year" IS NULL AND "inventory_lots"."vintage" IS NULL))
)
ON CONFLICT ("wine_id", "year") DO NOTHING;

-- ============================================================================
-- 3. ADD vintage_id TO INVENTORY_LOTS
-- ============================================================================

-- Add the new column (nullable initially)
ALTER TABLE "inventory_lots" ADD COLUMN IF NOT EXISTS "vintage_id" integer REFERENCES "vintages"("id") ON DELETE SET NULL;

-- Populate vintage_id from existing vintage field
UPDATE "inventory_lots" il
SET "vintage_id" = v."id"
FROM "vintages" v
WHERE v."wine_id" = il."wine_id"
AND (v."year" = il."vintage" OR (v."year" IS NULL AND il."vintage" IS NULL));

-- Create index on vintage_id
CREATE INDEX IF NOT EXISTS "inventory_vintage_id_idx" ON "inventory_lots" ("vintage_id");

-- NOTE: We keep the old 'vintage' column for now as a backup
-- Drop it in a future migration after verifying everything works:
-- ALTER TABLE "inventory_lots" DROP COLUMN "vintage";

-- Update the unique constraint to use vintage_id instead of vintage
-- First drop the old constraint (if it exists by this name)
-- ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_wine_id_cellar_id_format_id_vintage_bin_locati_key";
-- Then add new one with vintage_id... but this is risky, leaving for manual cleanup

-- ============================================================================
-- 4. FOOD PAIRINGS JUNCTION TABLE
-- ============================================================================

-- Normalized food categories
CREATE TABLE IF NOT EXISTS "food_categories" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "name" text NOT NULL UNIQUE,  -- 'beef', 'lamb', 'poultry', 'fish', etc.
    "display_name" text NOT NULL, -- 'Beef', 'Lamb', 'Poultry', 'Fish'
    "category" text,              -- 'meat', 'seafood', 'vegetarian', 'cheese', 'dessert'
    "image_url" text
);

-- Wine-food pairing junction
CREATE TABLE IF NOT EXISTS "wine_food_pairings" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "wine_id" integer NOT NULL REFERENCES "wines"("id") ON DELETE CASCADE,
    "food_category_id" integer NOT NULL REFERENCES "food_categories"("id") ON DELETE CASCADE,
    "strength" decimal(3, 2) DEFAULT 1.0,  -- pairing strength 0-1
    "data_source" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    
    CONSTRAINT "wine_food_unique" UNIQUE ("wine_id", "food_category_id")
);

CREATE INDEX IF NOT EXISTS "wine_food_wine_idx" ON "wine_food_pairings" ("wine_id");
CREATE INDEX IF NOT EXISTS "wine_food_category_idx" ON "wine_food_pairings" ("food_category_id");

-- Seed common food categories
INSERT INTO "food_categories" ("name", "display_name", "category") VALUES
    ('beef', 'Beef', 'meat'),
    ('lamb', 'Lamb', 'meat'),
    ('pork', 'Pork', 'meat'),
    ('veal', 'Veal', 'meat'),
    ('game', 'Game', 'meat'),
    ('poultry', 'Poultry', 'meat'),
    ('duck', 'Duck', 'meat'),
    ('fish', 'Fish', 'seafood'),
    ('shellfish', 'Shellfish', 'seafood'),
    ('salmon', 'Salmon', 'seafood'),
    ('tuna', 'Tuna', 'seafood'),
    ('oysters', 'Oysters', 'seafood'),
    ('lobster', 'Lobster', 'seafood'),
    ('crab', 'Crab', 'seafood'),
    ('pasta', 'Pasta', 'carbs'),
    ('risotto', 'Risotto', 'carbs'),
    ('pizza', 'Pizza', 'carbs'),
    ('cheese', 'Cheese', 'cheese'),
    ('hard_cheese', 'Hard Cheese', 'cheese'),
    ('soft_cheese', 'Soft Cheese', 'cheese'),
    ('blue_cheese', 'Blue Cheese', 'cheese'),
    ('goat_cheese', 'Goat Cheese', 'cheese'),
    ('vegetables', 'Vegetables', 'vegetarian'),
    ('mushrooms', 'Mushrooms', 'vegetarian'),
    ('salad', 'Salad', 'vegetarian'),
    ('spicy', 'Spicy Food', 'other'),
    ('asian', 'Asian Cuisine', 'other'),
    ('indian', 'Indian Cuisine', 'other'),
    ('mediterranean', 'Mediterranean', 'other'),
    ('bbq', 'BBQ', 'other'),
    ('charcuterie', 'Charcuterie', 'other'),
    ('dessert', 'Dessert', 'dessert'),
    ('chocolate', 'Chocolate', 'dessert'),
    ('fruit', 'Fruit', 'dessert'),
    ('aperitif', 'Aperitif', 'occasion'),
    ('digestif', 'Digestif', 'occasion')
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- 5. WINE TABLE ENRICHMENT
-- ============================================================================

ALTER TABLE "wines" ADD COLUMN IF NOT EXISTS "style_description" text;
ALTER TABLE "wines" ADD COLUMN IF NOT EXISTS "is_natural" boolean DEFAULT false;
ALTER TABLE "wines" ADD COLUMN IF NOT EXISTS "is_organic" boolean DEFAULT false;
ALTER TABLE "wines" ADD COLUMN IF NOT EXISTS "is_biodynamic" boolean DEFAULT false;
ALTER TABLE "wines" ADD COLUMN IF NOT EXISTS "data_source" text;

-- ============================================================================
-- 6. PRODUCER TABLE ENRICHMENT
-- ============================================================================

ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "founded_year" integer;
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "is_organic" boolean DEFAULT false;
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "is_biodynamic" boolean DEFAULT false;
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "is_natural" boolean DEFAULT false;
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "latitude" decimal(10, 7);
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "longitude" decimal(10, 7);
ALTER TABLE "producers" ADD COLUMN IF NOT EXISTS "data_source" text;

-- ============================================================================
-- 7. GRAPE TABLE ENRICHMENT
-- ============================================================================

ALTER TABLE "grapes" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "grapes" ADD COLUMN IF NOT EXISTS "origin_country" text;
ALTER TABLE "grapes" ADD COLUMN IF NOT EXISTS "aliases" text;  -- JSON array of alternative names

-- ============================================================================
-- 8. REGION TABLE ENRICHMENT
-- ============================================================================

ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "latitude" decimal(10, 7);
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "longitude" decimal(10, 7);
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "climate" text;
ALTER TABLE "regions" ADD COLUMN IF NOT EXISTS "soil_types" text;  -- JSON array
