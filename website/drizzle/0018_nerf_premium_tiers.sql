-- Delete old premium tiers and replace with mixed cash+gems rewards
DELETE FROM "battlepass_tier" WHERE "tier" = 'premium';

DO $$
DECLARE
    season_id INTEGER;
BEGIN
    SELECT id INTO season_id FROM "battlepass_season" WHERE "is_active" = true LIMIT 1;

    INSERT INTO "battlepass_tier" ("season_id","level","tier","task_description","task_type","task_target","reward_type","reward_amount","reward_label")
    VALUES
    (season_id,1,'premium','Make your first trade','trades',1,'gems',25,'25 💎 + $250'),
    (season_id,2,'premium','Play 3 arcade games','arcade_games',3,'gems',40,'40 💎 + $500'),
    (season_id,3,'premium','Log in 3 days in a row','login_streak',3,'gems',50,'50 💎 + $1,000'),
    (season_id,4,'premium','Make 10 trades','trades',10,'gems',75,'75 💎 + $2,000'),
    (season_id,5,'premium','Play 10 arcade games','arcade_games',10,'gems',100,'100 💎 + $5,000'),
    (season_id,6,'premium','Log in 7 days in a row','login_streak',7,'gems',125,'125 💎 + $10,000'),
    (season_id,7,'premium','Make 25 trades','trades',25,'gems',150,'150 💎 + $25,000'),
    (season_id,8,'premium','Play 25 arcade games','arcade_games',25,'gems',200,'200 💎 + $50,000'),
    (season_id,9,'premium','Log in 14 days in a row','login_streak',14,'gems',250,'250 💎 + $100,000'),
    (season_id,10,'premium','Complete the season','manual',1,'gems',400,'400 💎 + $250,000 🎉')
    ON CONFLICT DO NOTHING;
END $$;
