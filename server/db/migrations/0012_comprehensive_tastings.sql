-- Migration 0012: Create comprehensive tastings table
-- New table for detailed tasting assessments (visual, nose, palate, context)
-- Coexists with existing tasting_notes table (backward compatible)

CREATE TABLE IF NOT EXISTS "tastings" (
    "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    "wine_id" integer NOT NULL REFERENCES "wines"("id") ON DELETE CASCADE,
    "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "vintage" integer,
    
    -- Overall rating
    "rating" integer,  -- 0-100
    
    -- Visual assessment
    "visual_color" text,
    "visual_color_position" integer,  -- 0-100
    "visual_intensity" text,
    "visual_intensity_value" integer,  -- 0-100
    "visual_clarity" text,
    "visual_clarity_value" integer,  -- 0-100
    "visual_viscosity" text,
    "visual_viscosity_value" integer,  -- 0-100
    
    -- Nose
    "nose_intensity" text,
    "nose_intensity_value" integer,  -- 0-100
    "nose_development" text,
    "nose_development_value" integer,  -- 0-100
    "nose_aromas" text[],  -- Array of aroma names
    
    -- Palate
    "palate_sweetness" text,
    "palate_sweetness_value" integer,  -- 0-100
    "palate_acidity" text,
    "palate_acidity_value" integer,  -- 0-100
    "palate_tannin" text,
    "palate_tannin_value" integer,  -- 0-100
    "palate_body" text,
    "palate_body_value" integer,  -- 0-100
    "palate_alcohol" integer,  -- Actual ABV or percentage
    "palate_alcohol_value" integer,  -- 0-100 for slider
    "palate_finish" text,
    "palate_finish_value" integer,  -- 0-100
    "palate_flavors" text[],  -- Array of flavor names
    
    -- Context
    "context_people" text[],  -- Array of companion names
    "context_place" text,
    "context_meal" text,
    "context_temperature" integer,  -- Celsius
    "context_decanted_minutes" integer,
    
    -- Notes & Photos
    "notes" text,
    "photos" text[],  -- Array of photo URLs/paths
    
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "tastings_wine_idx" ON "tastings" ("wine_id");
CREATE INDEX IF NOT EXISTS "tastings_user_idx" ON "tastings" ("user_id");
CREATE INDEX IF NOT EXISTS "tastings_created_at_idx" ON "tastings" ("created_at");
