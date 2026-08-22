export interface PromoCode {
	id: number;
	code: string;
	description?: string;
	rewardAmount: string;
	rewardType: 'BASE_CURRENCY' | 'GEMS';
	maxUses?: number;
	isSecret: boolean;
	isActive: boolean;
	expiresAt?: string;
	createdAt: string;
	createdBy?: number;
	usedCount?: number;
}

export interface PromoCodeUse {
	id: number;
	flags: string;
	name: string;
	username: string;
	avatar: string;
}

export interface PromoCodeRedemption {
	id: number;
	userId: number;
	promoCodeId: number;
	rewardAmount: string;
	redeemedAt: string;
}
