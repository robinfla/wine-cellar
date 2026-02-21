CREATE TYPE "public"."critic" AS ENUM('robert_parker', 'wine_spectator', 'james_suckling', 'decanter', 'jancis_robinson', 'wine_enthusiast', 'vinous', 'other');--> statement-breakpoint
CREATE TYPE "public"."wishlist_item_type" AS ENUM('wine', 'producer');--> statement-breakpoint
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
CREATE TABLE "wine_references" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wine_references_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"producer_name" text NOT NULL,
	"wine_name" text NOT NULL,
	"color" "wine_color" NOT NULL,
	"region" text,
	"appellation" text,
	"grapes" text,
	"drink_from_years" integer NOT NULL,
	"drink_until_years" integer NOT NULL,
	"confidence" text DEFAULT 'medium' NOT NULL,
	"reasoning" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wine_references_producer_name_wine_name_color_unique" UNIQUE("producer_name","wine_name","color")
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
ALTER TABLE "wine_critic_scores" ADD CONSTRAINT "wine_critic_scores_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_producer_id_producers_id_fk" FOREIGN KEY ("producer_id") REFERENCES "public"."producers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "critic_scores_wine_idx" ON "wine_critic_scores" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "wine_ref_producer_idx" ON "wine_references" USING btree ("producer_name");--> statement-breakpoint
CREATE INDEX "wine_ref_name_idx" ON "wine_references" USING btree ("wine_name");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_item_type_idx" ON "wishlist_items" USING btree ("item_type");