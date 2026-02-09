CREATE TYPE "public"."allocation_status" AS ENUM('upcoming', 'to_claim', 'on_the_way', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."critic" AS ENUM('robert_parker', 'wine_spectator', 'james_suckling', 'decanter', 'jancis_robinson', 'wine_enthusiast', 'vinous', 'other');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('EUR', 'USD', 'GBP', 'ZAR', 'CHF');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('purchase', 'consume', 'gift', 'transfer', 'adjustment', 'loss');--> statement-breakpoint
CREATE TYPE "public"."maturity_status" AS ENUM('too_early', 'approaching', 'ready', 'peak', 'declining', 'past');--> statement-breakpoint
CREATE TYPE "public"."valuation_status" AS ENUM('pending', 'matched', 'needs_review', 'confirmed', 'no_match', 'manual');--> statement-breakpoint
CREATE TYPE "public"."wine_color" AS ENUM('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified');--> statement-breakpoint
CREATE TYPE "public"."wishlist_item_type" AS ENUM('wine', 'producer');--> statement-breakpoint
CREATE TABLE "allocation_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "allocation_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"allocation_id" integer NOT NULL,
	"wine_id" integer NOT NULL,
	"format_id" integer NOT NULL,
	"vintage" integer,
	"quantity_available" integer,
	"quantity_claimed" integer DEFAULT 0 NOT NULL,
	"price_per_bottle" numeric(10, 2),
	"currency" "currency" DEFAULT 'EUR',
	"quantity_received" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp,
	"inventory_lot_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_items_allocation_id_wine_id_format_id_vintage_unique" UNIQUE("allocation_id","wine_id","format_id","vintage")
);
--> statement-breakpoint
CREATE TABLE "allocations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "allocations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"producer_id" integer NOT NULL,
	"year" integer NOT NULL,
	"previous_year_id" integer,
	"claim_opens_at" timestamp,
	"claim_closes_at" timestamp,
	"status" "allocation_status" DEFAULT 'upcoming' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allocations_producer_id_year_user_id_unique" UNIQUE("producer_id","year","user_id")
);
--> statement-breakpoint
CREATE TABLE "appellations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "appellations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"region_id" integer,
	"level" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "appellations_name_region_id_unique" UNIQUE("name","region_id")
);
--> statement-breakpoint
CREATE TABLE "cellars" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cellars_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"is_virtual" boolean DEFAULT false NOT NULL,
	"notes" text,
	"rows" integer,
	"columns" integer,
	"layout_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cellars_name_user_id_unique" UNIQUE("name","user_id")
);
--> statement-breakpoint
CREATE TABLE "formats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "formats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"volume_ml" integer NOT NULL,
	CONSTRAINT "formats_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fx_rates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"from_currency" "currency" NOT NULL,
	"to_currency" "currency" NOT NULL,
	"rate" numeric(12, 6) NOT NULL,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_from_currency_to_currency_effective_date_unique" UNIQUE("from_currency","to_currency","effective_date")
);
--> statement-breakpoint
CREATE TABLE "grapes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "grapes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"color" "wine_color",
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "grapes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "inventory_events" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lot_id" integer NOT NULL,
	"event_type" "event_type" NOT NULL,
	"quantity_change" integer NOT NULL,
	"to_cellar_id" integer,
	"rating" integer,
	"tasting_notes" text,
	"event_date" timestamp DEFAULT now() NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_lots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "inventory_lots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"wine_id" integer NOT NULL,
	"cellar_id" integer NOT NULL,
	"format_id" integer NOT NULL,
	"vintage" integer,
	"quantity" integer DEFAULT 0 NOT NULL,
	"purchase_date" timestamp,
	"purchase_price_per_bottle" numeric(10, 2),
	"purchase_currency" "currency" DEFAULT 'EUR',
	"purchase_source" text,
	"bin_location" text,
	"import_hash" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_lots_wine_id_cellar_id_format_id_vintage_bin_location_user_id_unique" UNIQUE("wine_id","cellar_id","format_id","vintage","bin_location","user_id")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invitations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"code" text NOT NULL,
	"email" text,
	"used_at" timestamp,
	"used_by_user_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	CONSTRAINT "invitations_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "maturity_overrides" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "maturity_overrides_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lot_id" integer NOT NULL,
	"drink_from_year" integer,
	"drink_until_year" integer,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "maturity_overrides_lot_id_unique" UNIQUE("lot_id")
);
--> statement-breakpoint
CREATE TABLE "producers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "producers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"region_id" integer,
	"website" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "producers_name_region_id_user_id_unique" UNIQUE("name","region_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "regions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "regions_name_country_code_unique" UNIQUE("name","country_code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasting_notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tasting_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"lot_id" integer NOT NULL,
	"score" integer,
	"comment" text,
	"pairing" text,
	"tasted_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"preferred_currency" "currency" DEFAULT 'EUR',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wine_critic_scores" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wine_critic_scores_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wine_id" integer NOT NULL,
	"vintage" integer,
	"critic" "critic" NOT NULL,
	"score" integer NOT NULL,
	"note" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wine_critic_scores_wine_id_vintage_critic_unique" UNIQUE("wine_id","vintage","critic")
);
--> statement-breakpoint
CREATE TABLE "wine_grapes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wine_grapes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wine_id" integer NOT NULL,
	"grape_id" integer NOT NULL,
	"percentage" integer,
	CONSTRAINT "wine_grapes_wine_id_grape_id_unique" UNIQUE("wine_id","grape_id")
);
--> statement-breakpoint
CREATE TABLE "wine_valuations" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wine_valuations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"wine_id" integer NOT NULL,
	"vintage" integer,
	"price_estimate" numeric(10, 2),
	"price_low" numeric(10, 2),
	"price_high" numeric(10, 2),
	"source" text,
	"source_url" text,
	"source_wine_id" text,
	"source_name" text,
	"status" "valuation_status" DEFAULT 'pending' NOT NULL,
	"confidence" numeric(3, 2),
	"rating" numeric(2, 1),
	"ratings_count" integer,
	"fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wine_valuations_wine_id_vintage_unique" UNIQUE("wine_id","vintage")
);
--> statement-breakpoint
CREATE TABLE "wines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"producer_id" integer NOT NULL,
	"appellation_id" integer,
	"region_id" integer,
	"color" "wine_color" NOT NULL,
	"default_drink_from_years" integer,
	"default_drink_until_years" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wines_name_producer_id_color_user_id_unique" UNIQUE("name","producer_id","color","user_id")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wishlist_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"item_type" "wishlist_item_type" NOT NULL,
	"name" text NOT NULL,
	"wine_id" integer,
	"producer_id" integer,
	"region_id" integer,
	"vintage" integer,
	"notes" text,
	"wines_of_interest" text,
	"price_target" numeric(10, 2),
	"price_currency" "currency" DEFAULT 'EUR',
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_allocation_id_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."allocations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_format_id_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_previous_year_id_allocations_id_fk" FOREIGN KEY ("previous_year_id") REFERENCES "public"."allocations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appellations" ADD CONSTRAINT "appellations_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cellars" ADD CONSTRAINT "cellars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_events" ADD CONSTRAINT "inventory_events_to_cellar_id_cellars_id_fk" FOREIGN KEY ("to_cellar_id") REFERENCES "public"."cellars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_cellar_id_cellars_id_fk" FOREIGN KEY ("cellar_id") REFERENCES "public"."cellars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_format_id_formats_id_fk" FOREIGN KEY ("format_id") REFERENCES "public"."formats"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maturity_overrides" ADD CONSTRAINT "maturity_overrides_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasting_notes" ADD CONSTRAINT "tasting_notes_lot_id_inventory_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wine_critic_scores" ADD CONSTRAINT "wine_critic_scores_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wine_grapes" ADD CONSTRAINT "wine_grapes_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wine_grapes" ADD CONSTRAINT "wine_grapes_grape_id_grapes_id_fk" FOREIGN KEY ("grape_id") REFERENCES "public"."grapes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wine_valuations" ADD CONSTRAINT "wine_valuations_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_appellation_id_appellations_id_fk" FOREIGN KEY ("appellation_id") REFERENCES "public"."appellations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocation_items_allocation_idx" ON "allocation_items" USING btree ("allocation_id");--> statement-breakpoint
CREATE INDEX "allocation_items_wine_idx" ON "allocation_items" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "allocations_producer_idx" ON "allocations" USING btree ("producer_id");--> statement-breakpoint
CREATE INDEX "allocations_year_idx" ON "allocations" USING btree ("year");--> statement-breakpoint
CREATE INDEX "allocations_status_idx" ON "allocations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "allocations_user_idx" ON "allocations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cellars_user_idx" ON "cellars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_lot_idx" ON "inventory_events" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "events_date_idx" ON "inventory_events" USING btree ("event_date");--> statement-breakpoint
CREATE INDEX "inventory_wine_idx" ON "inventory_lots" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "inventory_cellar_idx" ON "inventory_lots" USING btree ("cellar_id");--> statement-breakpoint
CREATE INDEX "inventory_import_hash_idx" ON "inventory_lots" USING btree ("import_hash");--> statement-breakpoint
CREATE INDEX "inventory_user_idx" ON "inventory_lots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitations_code_idx" ON "invitations" USING btree ("code");--> statement-breakpoint
CREATE INDEX "producers_name_idx" ON "producers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "producers_user_idx" ON "producers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tasting_notes_lot_idx" ON "tasting_notes" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "critic_scores_wine_idx" ON "wine_critic_scores" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "valuations_wine_idx" ON "wine_valuations" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "valuations_status_idx" ON "wine_valuations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wines_name_idx" ON "wines" USING btree ("name");--> statement-breakpoint
CREATE INDEX "wines_producer_idx" ON "wines" USING btree ("producer_id");--> statement-breakpoint
CREATE INDEX "wines_user_idx" ON "wines" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_item_type_idx" ON "wishlist_items" USING btree ("item_type");