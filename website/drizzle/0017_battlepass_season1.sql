-- Create Season 1
INSERT INTO "battlepass_season" ("name", "description", "starts_at", "ends_at", "is_active")
VALUES (
    'Season 1 — The Beginning',
    'Complete daily tasks and earn rewards. VIP players unlock premium tiers with bonus gems and cash!',
    NOW(),
    NOW() + INTERVAL '60 days',
    true
) ON CONFLICT DO NOTHING;

-- Get the season id
DO $$
DECLARE
    season_id INTEGER;
BEGIN
    SELECT id INTO season_id FROM "battlepass_season" WHERE "is_active" = true LIMIT 1;

    -- Level 1
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,1,'free','Make your first trade','trades',1,'cash',500,'$500'),
    (season_id,1,'premium','Make your first trade','trades',1,'gems',100,'100 💎')
    ON CONFLICT DO NOTHING;

    -- Level 2
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,2,'free','Play 3 arcade games','arcade_games',3,'cash',1000,'$1,000'),
    (season_id,2,'premium','Play 3 arcade games','arcade_games',3,'gems',200,'200 💎')
    ON CONFLICT DO NOTHING;

    -- Level 3
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,3,'free','Log in 3 days in a row','login_streak',3,'cash',2500,'$2,500'),
    (season_id,3,'premium','Log in 3 days in a row','login_streak',3,'gems',350,'350 💎')
    ON CONFLICT DO NOTHING;

    -- Level 4
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,4,'free','Make 10 trades','trades',10,'cash',5000,'$5,000'),
    (season_id,4,'premium','Make 10 trades','trades',10,'gems',500,'500 💎')
    ON CONFLICT DO NOTHING;

    -- Level 5
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,5,'free','Play 10 arcade games','arcade_games',10,'cash',10000,'$10,000'),
    (season_id,5,'premium','Play 10 arcade games','arcade_games',10,'gems',750,'750 💎')
    ON CONFLICT DO NOTHING;

    -- Level 6
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,6,'free','Log in 7 days in a row','login_streak',7,'cash',20000,'$20,000'),
    (season_id,6,'premium','Log in 7 days in a row','login_streak',7,'gems',1000,'1,000 💎')
    ON CONFLICT DO NOTHING;

    -- Level 7
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,7,'free','Make 25 trades','trades',25,'cash',50000,'$50,000'),
    (season_id,7,'premium','Make 25 trades','trades',25,'gems',1500,'1,500 💎')
    ON CONFLICT DO NOTHING;

    -- Level 8
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,8,'free','Play 25 arcade games','arcade_games',25,'cash',100000,'$100,000'),
    (season_id,8,'premium','Play 25 arcade games','arcade_games',25,'gems',2000,'2,000 💎')
    ON CONFLICT DO NOTHING;

    -- Level 9
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,9,'free','Log in 14 days in a row','login_streak',14,'cash',250000,'$250,000'),
    (season_id,9,'premium','Log in 14 days in a row','login_streak',14,'gems',3000,'3,000 💎')
    ON CONFLICT DO NOTHING;

    -- Level 10
    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,10,'free','Complete the season (reach level 10)','manual',1,'cash',500000,'$500,000 🎉'),
    (season_id,10,'premium','Complete the season (reach level 10)','manual',1,'gems',5000,'5,000 💎 🎉')
    ON CONFLICT DO NOTHING;

END $$;
