-- Battlepass balance pass: keep early-game rewards fun, compress late-game
-- inflation (which was economy-wrecking), regenerate labels to match.
-- Free track cash: L1-20 -> x0.7 | L21-40 -> x0.55 | L41+ -> x0.4
UPDATE battlepass_tier SET
	reward_amount = CASE
		WHEN level <= 20 THEN ROUND(reward_amount * 0.70 / 50) * 50
		WHEN level <= 40 THEN ROUND(reward_amount * 0.55 / 500) * 500
		ELSE ROUND(reward_amount * 0.40 / 1000) * 1000
	END,
	reward_label = '$' || to_char(
		CASE
			WHEN level <= 20 THEN ROUND(reward_amount * 0.70 / 50) * 50
			WHEN level <= 40 THEN ROUND(reward_amount * 0.55 / 500) * 500
			ELSE ROUND(reward_amount * 0.40 / 1000) * 1000
		END,
		'FM999,999,999')
WHERE tier = 'free' AND reward_type = 'cash';

-- Premium track gems: x0.65 (min 8); cash bonus in code stays gems x 25,
-- so label cash = gems * 25 to stay consistent.
UPDATE battlepass_tier SET
	reward_amount = GREATEST(8, ROUND(reward_amount * 0.65)),
	reward_label = GREATEST(8, ROUND(reward_amount * 0.65)) || E'\uD83D\uDC8E + $' ||
		to_char(GREATEST(8, ROUND(reward_amount * 0.65)) * 25, 'FM999,999,999')
WHERE tier = 'premium' AND reward_type = 'gems';
