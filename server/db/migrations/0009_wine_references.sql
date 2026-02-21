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
CREATE INDEX "wine_ref_producer_idx" ON "wine_references" USING btree ("producer_name");--> statement-breakpoint
CREATE INDEX "wine_ref_name_idx" ON "wine_references" USING btree ("wine_name");
