export async function isNameAppropriate(_name: string): Promise<boolean> {
	// Moderation service not configured — allow all names
	return true;
}
