import { auth } from '$lib/auth';
import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { user, predictionQuestion } from '$lib/server/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';
import { validateQuestion } from '$lib/server/ai';
import { isNameAppropriate } from '$lib/server/moderation';
import type { RequestHandler } from './$types';
import { checkAndAwardAchievements } from '$lib/server/achievements';
import { hasFlag } from '$lib/data/flags';

const MIN_BALANCE_REQUIRED = 100000; // $100k
const MAX_QUESTIONS_PER_HOUR = 2;
const MIN_RESOLUTION_HOURS = 1;
const MAX_RESOLUTION_DAYS = 30;

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not authenticated');

	const userId = Number(session.user.id);

	const [currentUser] = await db
		.select({ flags: user.flags })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (hasFlag(currentUser.flags, 'NO_HOPIUM'))
		return json({ error: "You aren't authorized to use Hopium." }, { status: 403 });

	const { question } = await request.json();

	const cleaned = (question ?? '').trim();
	if (cleaned.length < 10 || cleaned.length > 200) {
		return json({ error: 'Question must be between 10 and 200 characters' }, { status: 400 });
	}

	if (!(await isNameAppropriate(cleaned))) {
		return json({ error: 'Question contains inappropriate content' }, { status: 400 });
	}
	const now = new Date();

	try {
		// Phase 1: quick pre-checks (balance + hourly cap). Runs fast, no AI involved.
		await db.transaction(async (tx) => {
			const [userData] = await tx
				.select({ baseCurrencyBalance: user.baseCurrencyBalance })
				.from(user)
				.where(eq(user.id, userId))
				.for('update')
				.limit(1);

			if (!userData || Number(userData.baseCurrencyBalance) < MIN_BALANCE_REQUIRED) {
				throw new Error(
					`You need at least $${MIN_BALANCE_REQUIRED.toLocaleString()} to create questions`
				);
			}

			// Check hourly creation limit
			const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
			const [recentQuestions] = await tx
				.select({ count: count() })
				.from(predictionQuestion)
				.where(
					and(
						eq(predictionQuestion.creatorId, userId),
						gte(predictionQuestion.createdAt, oneHourAgo)
					)
				);

			if (Number(recentQuestions.count) >= MAX_QUESTIONS_PER_HOUR) {
				throw new Error(`You can only create ${MAX_QUESTIONS_PER_HOUR} questions per hour`);
			}
		});

		// Phase 2: create the question immediately with sensible defaults —
		// the user isn't blocked on the AI validator. Full AI validation runs in
		// the background and refines the date/flags or cancels the question.
		const coinSymbols = extractCoinSymbols(cleaned);
		const minResolutionDate = new Date(now.getTime() + MIN_RESOLUTION_HOURS * 60 * 60 * 1000);
		const maxResolutionDate = new Date(now.getTime() + MAX_RESOLUTION_DAYS * 24 * 60 * 60 * 1000);
		const defaultResolutionDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

		const [newQuestion] = await db
			.insert(predictionQuestion)
			.values({
				creatorId: userId,
				question: cleaned,
				resolutionDate: defaultResolutionDate,
				requiresWebSearch: coinSymbols.length === 0,
				validationReason: 'Validation in progress'
			})
			.returning();

		checkAndAwardAchievements(userId, ['hopium']);

		void validateQuestionInBackground(newQuestion.id, cleaned);

		return json({
			success: true,
			question: {
				id: newQuestion.id,
				question: newQuestion.question,
				resolutionDate: newQuestion.resolutionDate,
				requiresWebSearch: newQuestion.requiresWebSearch
			}
		});
	} catch (e) {
		console.error('Question creation error:', e);
		return json({ error: (e as Error).message }, { status: 400 });
	}
};

// Local heuristic: questions that don't reference a platform coin usually need
// external (web) data to be resolved.
const COIN_SYMBOL_RE = /\*([A-Z]{2,10})(?![A-Z])/g;
function extractCoinSymbols(text: string): string[] {
	return [...new Set([...text.toUpperCase().matchAll(COIN_SYMBOL_RE)].map((m) => m[1]))];
}

function clampResolutionDate(date: Date, min: Date, max: Date): Date {
	if (date < min) return min;
	if (date > max) return max;
	return date;
}

async function validateQuestionInBackground(questionId: number, question: string) {
	try {
		const validation = await validateQuestion(question);

		if (!validation.isValid) {
			await db
				.update(predictionQuestion)
				.set({ status: 'CANCELLED', validationReason: validation.reason })
				.where(eq(predictionQuestion.id, questionId));
			console.log(`Question ${questionId} cancelled by background validation: ${validation.reason}`);
			return;
		}

		const suggested =
			validation.suggestedResolutionDate &&
			!isNaN(validation.suggestedResolutionDate.getTime())
				? validation.suggestedResolutionDate
				: null;

		const min = new Date(Date.now() + MIN_RESOLUTION_HOURS * 60 * 60 * 1000);
		const max = new Date(Date.now() + MAX_RESOLUTION_DAYS * 24 * 60 * 60 * 1000);
		const fallback = new Date(Date.now() + 24 * 60 * 60 * 1000);

		await db
			.update(predictionQuestion)
			.set({
				resolutionDate: suggested ? clampResolutionDate(suggested, min, max) : fallback,
				requiresWebSearch: validation.requiresWebSearch,
				validationReason: validation.reason
			})
			.where(eq(predictionQuestion.id, questionId));
	} catch (error) {
		console.error('Background question validation failed:', error);
	}
}
