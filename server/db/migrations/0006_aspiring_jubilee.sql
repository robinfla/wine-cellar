ALTER TABLE "allocation_items" DROP CONSTRAINT "allocation_items_allocation_id_wine_id_format_id_unique";--> statement-breakpoint
ALTER TABLE "allocation_items" ADD COLUMN "vintage" integer;--> statement-breakpoint
ALTER TABLE "allocation_items" ADD CONSTRAINT "allocation_items_allocation_id_wine_id_format_id_vintage_unique" UNIQUE("allocation_id","wine_id","format_id","vintage");