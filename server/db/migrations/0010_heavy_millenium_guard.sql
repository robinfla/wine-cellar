CREATE TYPE "public"."critic" AS ENUM('robert_parker', 'wine_spectator', 'james_suckling', 'decanter', 'jancis_robinson', 'wine_enthusiast', 'vinous', 'other');--> statement-breakpoint
CREATE TYPE "public"."wishlist_item_type" AS ENUM('wine', 'producer');--> statement-breakpoint
CREATE TABLE "cellar_racks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cellar_racks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"space_id" integer NOT NULL,
	"wall_id" integer,
	"columns" integer NOT NULL,
	"rows" integer NOT NULL,
	"depth" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cellar_spaces" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cellar_spaces_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cellar_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rack_slots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "rack_slots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rack_id" integer NOT NULL,
	"row" integer NOT NULL,
	"column" integer NOT NULL,
	"depth_position" integer DEFAULT 1 NOT NULL,
	"inventory_lot_id" integer,
	CONSTRAINT "rack_slots_rack_id_row_column_depth_position_unique" UNIQUE("rack_id","row","column","depth_position")
);
--> statement-breakpoint
CREATE TABLE "space_walls" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "space_walls_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"space_id" integer NOT NULL,
	"position" text NOT NULL,
	CONSTRAINT "space_walls_space_id_position_unique" UNIQUE("space_id","position")
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
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wine_critic_scores_wine_id_vintage_critic_unique" UNIQUE("wine_id","vintage","critic")
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
DROP INDEX "wine_ref_producer_idx";--> statement-breakpoint
DROP INDEX "wine_ref_name_idx";--> statement-breakpoint
ALTER TABLE "cellar_racks" ADD CONSTRAINT "cellar_racks_space_id_cellar_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."cellar_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cellar_racks" ADD CONSTRAINT "cellar_racks_wall_id_space_walls_id_fk" FOREIGN KEY ("wall_id") REFERENCES "public"."space_walls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cellar_spaces" ADD CONSTRAINT "cellar_spaces_cellar_id_cellars_id_fk" FOREIGN KEY ("cellar_id") REFERENCES "public"."cellars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cellar_spaces" ADD CONSTRAINT "cellar_spaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_slots" ADD CONSTRAINT "rack_slots_rack_id_cellar_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."cellar_racks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rack_slots" ADD CONSTRAINT "rack_slots_inventory_lot_id_inventory_lots_id_fk" FOREIGN KEY ("inventory_lot_id") REFERENCES "public"."inventory_lots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_walls" ADD CONSTRAINT "space_walls_space_id_cellar_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."cellar_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wine_critic_scores" ADD CONSTRAINT "wine_critic_scores_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "racks_space_idx" ON "cellar_racks" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "spaces_cellar_idx" ON "cellar_spaces" USING btree ("cellar_id");--> statement-breakpoint
CREATE INDEX "spaces_user_idx" ON "cellar_spaces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "slots_rack_idx" ON "rack_slots" USING btree ("rack_id");--> statement-breakpoint
CREATE INDEX "slots_lot_idx" ON "rack_slots" USING btree ("inventory_lot_id");--> statement-breakpoint
CREATE INDEX "walls_space_idx" ON "space_walls" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "critic_scores_wine_idx" ON "wine_critic_scores" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_item_type_idx" ON "wishlist_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "wine_ref_producer_idx" ON "wine_references" USING btree ("producer_name");--> statement-breakpoint
CREATE INDEX "wine_ref_name_idx" ON "wine_references" USING btree ("wine_name");