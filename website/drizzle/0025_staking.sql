-- Coin staking: per-coin pool tracker and per-user stakes
CREATE TABLE IF NOT EXISTS "coin_staking_pool" (
	"id" serial PRIMARY KEY,
	"coin_id" integer NOT NULL UNIQUE REFERENCES "coin"("id") ON DELETE CASCADE,
	"total_staked" numeric(30, 8) NOT NULL DEFAULT 0,
	"distribution_rate_4h" numeric(30, 8) NOT NULL DEFAULT 0,
	"reward_per_share" numeric(30, 8) NOT NULL DEFAULT 0,
	"last_epoch_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_stake" (
	"id" serial PRIMARY KEY,
	"user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"coin_id" integer NOT NULL REFERENCES "coin"("id") ON DELETE CASCADE,
	"amount" numeric(30, 8) NOT NULL DEFAULT 0,
	"reward_debt" numeric(30, 8) NOT NULL DEFAULT 0,
	"claimable_rewards" numeric(30, 8) NOT NULL DEFAULT 0,
	"updated_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "user_stake_user_coin_unique" UNIQUE ("user_id", "coin_id")
);
