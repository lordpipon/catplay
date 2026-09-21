import type { SeasonTrophyTier } from '$lib/data/seasons';

export interface SeasonTrophyEntry {
	seasonId: number;
	seasonNumber: number;
	seasonName: string;
	rank: number;
	tier: SeasonTrophyTier;
	score: number;
	awardedAt: Date;
}

export interface UserProfile {
	id: number;
	name: string;
	username: string;
	bio: string | null;
	image: string | null;
	createdAt: Date;
	flags: bigint;
	baseCurrencyBalance: number;
	totalPortfolioValue: number;
	loginStreak: number;
	timezone: number;

	prestigeLevel: number | null;

	arcadeWins: number;
	arcadeLosses: number;

	halloweenBadge2026?: boolean;
	bestTrophy?: {
		rank: number;
		tier: SeasonTrophyTier;
		seasonNumber: number;
		seasonName: string;
		entrants: number;
	} | null;
	trophyCount?: number;
	seasonTrophies?: SeasonTrophyEntry[];
}

export interface UserStats {
	totalPortfolioValue: number;
	baseCurrencyBalance: number;
	holdingsValue: number;
	holdingsCount: number;
	coinsCreated: number;
	totalTransactions: number;
	totalBuyVolume: number;
	totalSellVolume: number;
	transactions24h: number;
	buyVolume24h: number;
	sellVolume24h: number;
}

export interface CreatedCoin {
	id: number;
	name: string;
	symbol: string;
	icon: string | null;
	currentPrice: string;
	marketCap: string;
	volume24h: string;
	change24h: string;
	createdAt: Date;
}

export interface RecentTransaction {
	id: number;
	type: 'BUY' | 'SELL';
	coinSymbol: string;
	coinName: string;
	coinIcon: string | null;
	quantity: string;
	pricePerCoin: string;
	totalBaseCurrencyAmount: string;
	timestamp: Date;
}

export interface UserProfileData {
	profile: UserProfile;
	stats: UserStats;
	createdCoins: CreatedCoin[];
	recentTransactions: RecentTransaction[];
}

export interface FollowUser {
	id: number;
	name: string;
	username: string;
	image: string | null;
	createdAt: Date;
}

export interface UserFollowData {
	followersCount: number;
	followingCount: number;
	followers: FollowUser[];
	following: FollowUser[];
	isFollowing: boolean;
}

export type FollowRelation = 'followers' | 'following';

export interface FollowPageData {
	relation: FollowRelation;
	items: FollowUser[];
	page: number;
	perPage: number;
	totalCount: number;
	totalPages: number;
}

export type ProfileReaction = 'LIKE' | 'DISLIKE';

export interface UserProfileFeedback {
	likesCount: number;
	dislikesCount: number;
	userReaction: ProfileReaction | null;
}
