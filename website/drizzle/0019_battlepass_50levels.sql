-- Wipe and redo all tiers with 50 levels
DELETE FROM "battlepass_tier";
DELETE FROM "battlepass_progress";

DO $$
DECLARE
    s INTEGER;
BEGIN
    SELECT id INTO s FROM "battlepass_season" WHERE "is_active" = true LIMIT 1;

    -- Each level has ONE task with an incremental target
    -- taskType 'trades_total', 'arcade_total', 'streak' use snapshot thresholds
    -- Level unlocks when you hit that threshold

    -- FREE TIERS (cash rewards scaling up)
    INSERT INTO "battlepass_tier" (season_id,level,tier,task_description,task_type,task_target,reward_type,reward_amount,reward_label) VALUES
    (s,1, 'free','Make 1 trade',           'trades',    1,   'cash',500,    '$500'),
    (s,2, 'free','Play 2 arcade games',    'arcade_games',2, 'cash',750,    '$750'),
    (s,3, 'free','Log in 2 days in a row', 'login_streak',2, 'cash',1000,   '$1,000'),
    (s,4, 'free','Make 5 trades',          'trades',    5,   'cash',1500,   '$1,500'),
    (s,5, 'free','Play 5 arcade games',    'arcade_games',5, 'cash',2000,   '$2,000'),
    (s,6, 'free','Log in 3 days in a row', 'login_streak',3, 'cash',2500,   '$2,500'),
    (s,7, 'free','Make 10 trades',         'trades',    10,  'cash',3500,   '$3,500'),
    (s,8, 'free','Play 10 arcade games',   'arcade_games',10,'cash',5000,   '$5,000'),
    (s,9, 'free','Log in 5 days in a row', 'login_streak',5, 'cash',7000,   '$7,000'),
    (s,10,'free','Make 20 trades',         'trades',    20,  'cash',10000,  '$10,000'),
    (s,11,'free','Play 20 arcade games',   'arcade_games',20,'cash',12500,  '$12,500'),
    (s,12,'free','Log in 7 days in a row', 'login_streak',7, 'cash',15000,  '$15,000'),
    (s,13,'free','Make 35 trades',         'trades',    35,  'cash',20000,  '$20,000'),
    (s,14,'free','Play 35 arcade games',   'arcade_games',35,'cash',25000,  '$25,000'),
    (s,15,'free','Log in 10 days in a row','login_streak',10,'cash',30000,  '$30,000'),
    (s,16,'free','Make 50 trades',         'trades',    50,  'cash',40000,  '$40,000'),
    (s,17,'free','Play 50 arcade games',   'arcade_games',50,'cash',50000,  '$50,000'),
    (s,18,'free','Log in 14 days in a row','login_streak',14,'cash',65000,  '$65,000'),
    (s,19,'free','Make 75 trades',         'trades',    75,  'cash',80000,  '$80,000'),
    (s,20,'free','Play 75 arcade games',   'arcade_games',75,'cash',100000, '$100,000'),
    (s,21,'free','Log in 20 days in a row','login_streak',20,'cash',120000, '$120,000'),
    (s,22,'free','Make 100 trades',        'trades',    100, 'cash',150000, '$150,000'),
    (s,23,'free','Play 100 arcade games',  'arcade_games',100,'cash',175000,'$175,000'),
    (s,24,'free','Log in 25 days in a row','login_streak',25,'cash',200000, '$200,000'),
    (s,25,'free','Make 150 trades',        'trades',    150, 'cash',250000, '$250,000'),
    (s,26,'free','Play 150 arcade games',  'arcade_games',150,'cash',300000,'$300,000'),
    (s,27,'free','Log in 30 days in a row','login_streak',30,'cash',350000, '$350,000'),
    (s,28,'free','Make 200 trades',        'trades',    200, 'cash',400000, '$400,000'),
    (s,29,'free','Play 200 arcade games',  'arcade_games',200,'cash',450000,'$450,000'),
    (s,30,'free','Log in 35 days in a row','login_streak',35,'cash',500000, '$500,000'),
    (s,31,'free','Make 250 trades',        'trades',    250, 'cash',600000, '$600,000'),
    (s,32,'free','Play 250 arcade games',  'arcade_games',250,'cash',700000,'$700,000'),
    (s,33,'free','Log in 40 days in a row','login_streak',40,'cash',800000, '$800,000'),
    (s,34,'free','Make 300 trades',        'trades',    300, 'cash',900000, '$900,000'),
    (s,35,'free','Play 300 arcade games',  'arcade_games',300,'cash',1000000,'$1,000,000'),
    (s,36,'free','Make 350 trades',        'trades',    350, 'cash',1200000,'$1,200,000'),
    (s,37,'free','Play 350 arcade games',  'arcade_games',350,'cash',1400000,'$1,400,000'),
    (s,38,'free','Log in 45 days in a row','login_streak',45,'cash',1600000,'$1,600,000'),
    (s,39,'free','Make 400 trades',        'trades',    400, 'cash',1800000,'$1,800,000'),
    (s,40,'free','Play 400 arcade games',  'arcade_games',400,'cash',2000000,'$2,000,000'),
    (s,41,'free','Make 450 trades',        'trades',    450, 'cash',2250000,'$2,250,000'),
    (s,42,'free','Play 450 arcade games',  'arcade_games',450,'cash',2500000,'$2,500,000'),
    (s,43,'free','Log in 50 days in a row','login_streak',50,'cash',2750000,'$2,750,000'),
    (s,44,'free','Make 500 trades',        'trades',    500, 'cash',3000000,'$3,000,000'),
    (s,45,'free','Play 500 arcade games',  'arcade_games',500,'cash',3500000,'$3,500,000'),
    (s,46,'free','Make 600 trades',        'trades',    600, 'cash',4000000,'$4,000,000'),
    (s,47,'free','Play 600 arcade games',  'arcade_games',600,'cash',4500000,'$4,500,000'),
    (s,48,'free','Make 750 trades',        'trades',    750, 'cash',5000000,'$5,000,000'),
    (s,49,'free','Play 750 arcade games',  'arcade_games',750,'cash',6000000,'$6,000,000'),
    (s,50,'free','The grind is real (750 trades + 750 games)','manual',1,'cash',10000000,'$10,000,000 🏆')
    ON CONFLICT DO NOTHING;

    -- PREMIUM TIERS (gems + cash bonus)
    INSERT INTO "battlepass_tier" (season_id,level,tier,task_description,task_type,task_target,reward_type,reward_amount,reward_label) VALUES
    (s,1, 'premium','Make 1 trade',           'trades',    1,   'gems',15,  '15💎 + $250'),
    (s,2, 'premium','Play 2 arcade games',    'arcade_games',2, 'gems',20,  '20💎 + $500'),
    (s,3, 'premium','Log in 2 days in a row', 'login_streak',2, 'gems',25,  '25💎 + $750'),
    (s,4, 'premium','Make 5 trades',          'trades',    5,   'gems',30,  '30💎 + $1,000'),
    (s,5, 'premium','Play 5 arcade games',    'arcade_games',5, 'gems',35,  '35💎 + $1,250'),
    (s,6, 'premium','Log in 3 days in a row', 'login_streak',3, 'gems',40,  '40💎 + $1,500'),
    (s,7, 'premium','Make 10 trades',         'trades',    10,  'gems',45,  '45💎 + $2,000'),
    (s,8, 'premium','Play 10 arcade games',   'arcade_games',10,'gems',50,  '50💎 + $2,500'),
    (s,9, 'premium','Log in 5 days in a row', 'login_streak',5, 'gems',55,  '55💎 + $3,000'),
    (s,10,'premium','Make 20 trades',         'trades',    20,  'gems',65,  '65💎 + $4,000'),
    (s,11,'premium','Play 20 arcade games',   'arcade_games',20,'gems',70,  '70💎 + $5,000'),
    (s,12,'premium','Log in 7 days in a row', 'login_streak',7, 'gems',75,  '75💎 + $6,000'),
    (s,13,'premium','Make 35 trades',         'trades',    35,  'gems',80,  '80💎 + $7,500'),
    (s,14,'premium','Play 35 arcade games',   'arcade_games',35,'gems',85,  '85💎 + $9,000'),
    (s,15,'premium','Log in 10 days in a row','login_streak',10,'gems',90,  '90💎 + $10,000'),
    (s,16,'premium','Make 50 trades',         'trades',    50,  'gems',100, '100💎 + $12,500'),
    (s,17,'premium','Play 50 arcade games',   'arcade_games',50,'gems',100, '100💎 + $15,000'),
    (s,18,'premium','Log in 14 days in a row','login_streak',14,'gems',110, '110💎 + $20,000'),
    (s,19,'premium','Make 75 trades',         'trades',    75,  'gems',120, '120💎 + $25,000'),
    (s,20,'premium','Play 75 arcade games',   'arcade_games',75,'gems',125, '125💎 + $30,000'),
    (s,21,'premium','Log in 20 days in a row','login_streak',20,'gems',130, '130💎 + $35,000'),
    (s,22,'premium','Make 100 trades',        'trades',    100, 'gems',140, '140💎 + $45,000'),
    (s,23,'premium','Play 100 arcade games',  'arcade_games',100,'gems',150,'150💎 + $55,000'),
    (s,24,'premium','Log in 25 days in a row','login_streak',25,'gems',160, '160💎 + $65,000'),
    (s,25,'premium','Make 150 trades',        'trades',    150, 'gems',175, '175💎 + $75,000'),
    (s,26,'premium','Play 150 arcade games',  'arcade_games',150,'gems',175,'175💎 + $90,000'),
    (s,27,'premium','Log in 30 days in a row','login_streak',30,'gems',185, '185💎 + $100,000'),
    (s,28,'premium','Make 200 trades',        'trades',    200, 'gems',195, '195💎 + $120,000'),
    (s,29,'premium','Play 200 arcade games',  'arcade_games',200,'gems',200,'200💎 + $140,000'),
    (s,30,'premium','Log in 35 days in a row','login_streak',35,'gems',210, '210💎 + $160,000'),
    (s,31,'premium','Make 250 trades',        'trades',    250, 'gems',220, '220💎 + $180,000'),
    (s,32,'premium','Play 250 arcade games',  'arcade_games',250,'gems',225,'225💎 + $200,000'),
    (s,33,'premium','Log in 40 days in a row','login_streak',40,'gems',235, '235💎 + $225,000'),
    (s,34,'premium','Make 300 trades',        'trades',    300, 'gems',245, '245💎 + $250,000'),
    (s,35,'premium','Play 300 arcade games',  'arcade_games',300,'gems',250,'250💎 + $275,000'),
    (s,36,'premium','Make 350 trades',        'trades',    350, 'gems',260, '260💎 + $300,000'),
    (s,37,'premium','Play 350 arcade games',  'arcade_games',350,'gems',265,'265💎 + $325,000'),
    (s,38,'premium','Log in 45 days in a row','login_streak',45,'gems',275, '275💎 + $350,000'),
    (s,39,'premium','Make 400 trades',        'trades',    400, 'gems',285, '285💎 + $400,000'),
    (s,40,'premium','Play 400 arcade games',  'arcade_games',400,'gems',295,'295💎 + $450,000'),
    (s,41,'premium','Make 450 trades',        'trades',    450, 'gems',305, '305💎 + $500,000'),
    (s,42,'premium','Play 450 arcade games',  'arcade_games',450,'gems',315,'315💎 + $550,000'),
    (s,43,'premium','Log in 50 days in a row','login_streak',50,'gems',325, '325💎 + $600,000'),
    (s,44,'premium','Make 500 trades',        'trades',    500, 'gems',340, '340💎 + $700,000'),
    (s,45,'premium','Play 500 arcade games',  'arcade_games',500,'gems',350,'350💎 + $800,000'),
    (s,46,'premium','Make 600 trades',        'trades',    600, 'gems',370, '370💎 + $900,000'),
    (s,47,'premium','Play 600 arcade games',  'arcade_games',600,'gems',385,'385💎 + $1,000,000'),
    (s,48,'premium','Make 750 trades',        'trades',    750, 'gems',400, '400💎 + $1,250,000'),
    (s,49,'premium','Play 750 arcade games',  'arcade_games',750,'gems',425,'425💎 + $1,500,000'),
    (s,50,'premium','Max level achieved',     'manual',    1,   'gems',500, '500💎 + $2,500,000 👑')
    ON CONFLICT DO NOTHING;

END $$;
