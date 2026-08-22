CREATE TYPE "admin_action" AS ENUM('BAN', 'UNBAN', 'PROMO_CREATE', 'PROMO_DELETE');

CREATE TABLE "admin_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"action" "admin_action" NOT NULL,
	"target_user_id" integer,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_admin_id_user_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "admin_log" ADD CONSTRAINT "admin_log_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "admin_log_admin_id_idx" ON "admin_log" USING btree ("admin_id");
CREATE INDEX "admin_log_action_idx" ON "admin_log" USING btree ("action");
CREATE INDEX "admin_log_created_at_idx" ON "admin_log" USING btree ("created_at");
