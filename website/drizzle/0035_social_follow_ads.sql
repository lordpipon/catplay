CREATE TYPE "public"."profile_reaction_type" AS ENUM('LIKE', 'DISLIKE');--> statement-breakpoint
CREATE TABLE "user_follow" (
	"id" serial PRIMARY KEY NOT NULL,
	"follower_id" integer NOT NULL,
	"following_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_follow_unique" UNIQUE("follower_id","following_id"),
	CONSTRAINT "no_self_follow" CHECK ("follower_id" != "following_id")
);--> statement-breakpoint
CREATE TABLE "profile_reaction" (
	"reactor_user_id" integer NOT NULL,
	"target_user_id" integer NOT NULL,
	"reaction" "profile_reaction_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_reaction_reactor_user_id_target_user_id_pk" PRIMARY KEY("reactor_user_id","target_user_id"),
	CONSTRAINT "no_self_profile_reaction" CHECK ("reactor_user_id" != "target_user_id")
);--> statement-breakpoint
CREATE TABLE "advertisement" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"coin_id" integer NOT NULL,
	"duration_hours" integer NOT NULL,
	"total_cost" numeric(30, 8) NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_follower_id_user_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follow" ADD CONSTRAINT "user_follow_following_id_user_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reaction" ADD CONSTRAINT "profile_reaction_reactor_user_id_user_id_fk" FOREIGN KEY ("reactor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_reaction" ADD CONSTRAINT "profile_reaction_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertisement" ADD CONSTRAINT "advertisement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advertisement" ADD CONSTRAINT "advertisement_coin_id_coin_id_fk" FOREIGN KEY ("coin_id") REFERENCES "public"."coin"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_follow_follower_id_idx" ON "user_follow" USING btree ("follower_id");--> statement-breakpoint
CREATE INDEX "user_follow_following_id_idx" ON "user_follow" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "profile_reaction_target_user_id_idx" ON "profile_reaction" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "advertisement_user_id_idx" ON "advertisement" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "advertisement_coin_id_idx" ON "advertisement" USING btree ("coin_id");--> statement-breakpoint
CREATE INDEX "advertisement_expires_at_idx" ON "advertisement" USING btree ("expires_at");