ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;

-- Set rob.flamant@gmail.com as admin
UPDATE "users" SET "is_admin" = true WHERE "email" = 'rob.flamant@gmail.com';