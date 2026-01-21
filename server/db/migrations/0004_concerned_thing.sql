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
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_user_id_users_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_code_idx" ON "invitations" USING btree ("code");