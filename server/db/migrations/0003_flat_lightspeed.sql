ALTER TABLE "valuations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "valuations" CASCADE;--> statement-breakpoint
ALTER TABLE "allocations" DROP CONSTRAINT "allocations_producer_id_year_unique";--> statement-breakpoint
ALTER TABLE "cellars" DROP CONSTRAINT "cellars_name_unique";--> statement-breakpoint
ALTER TABLE "inventory_lots" DROP CONSTRAINT "inventory_lots_wine_id_cellar_id_format_id_vintage_bin_location_unique";--> statement-breakpoint
ALTER TABLE "producers" DROP CONSTRAINT "producers_name_region_id_unique";--> statement-breakpoint
ALTER TABLE "wines" DROP CONSTRAINT "wines_name_producer_id_color_unique";--> statement-breakpoint
ALTER TABLE "allocations" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "cellars" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "producers" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "wines" ADD COLUMN "user_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cellars" ADD CONSTRAINT "cellars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocations_user_idx" ON "allocations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cellars_user_idx" ON "cellars" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "inventory_user_idx" ON "inventory_lots" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "producers_user_idx" ON "producers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wines_user_idx" ON "wines" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_producer_id_year_user_id_unique" UNIQUE("producer_id","year","user_id");--> statement-breakpoint
ALTER TABLE "cellars" ADD CONSTRAINT "cellars_name_user_id_unique" UNIQUE("name","user_id");--> statement-breakpoint
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_wine_id_cellar_id_format_id_vintage_bin_location_user_id_unique" UNIQUE("wine_id","cellar_id","format_id","vintage","bin_location","user_id");--> statement-breakpoint
ALTER TABLE "producers" ADD CONSTRAINT "producers_name_region_id_user_id_unique" UNIQUE("name","region_id","user_id");--> statement-breakpoint
ALTER TABLE "wines" ADD CONSTRAINT "wines_name_producer_id_color_user_id_unique" UNIQUE("name","producer_id","color","user_id");