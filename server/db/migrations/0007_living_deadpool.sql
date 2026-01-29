CREATE TYPE "public"."valuation_status" AS ENUM('pending', 'matched', 'needs_review', 'confirmed', 'no_match', 'manual');--> statement-breakpoint
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
	"fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wine_valuations_wine_id_vintage_unique" UNIQUE("wine_id","vintage")
);
--> statement-breakpoint
ALTER TABLE "wine_valuations" ADD CONSTRAINT "wine_valuations_wine_id_wines_id_fk" FOREIGN KEY ("wine_id") REFERENCES "public"."wines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "valuations_wine_idx" ON "wine_valuations" USING btree ("wine_id");--> statement-breakpoint
CREATE INDEX "valuations_status_idx" ON "wine_valuations" USING btree ("status");