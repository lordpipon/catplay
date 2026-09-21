import { redis } from '$lib/server/redis';
import { eq } from 'drizzle-orm';

// Well-known public proxy / VPN / hosting ranges (CIDR).
// These are curated static ranges of the largest public proxy pools, residential-proxy
// providers, and abusive datacenter/VPN egresses. Loaded into Redis on boot so the
// registration path only does a fast set lookup. Extend this list over time.
const PROXY_CIDRS: string[] = [
	// Luminati / Bright Data residential-proxy egress ranges (well-known supersets)
	'64.44.64.0/18',
	'64.98.96.0/19',
	'103.197.96.0/20',
	'146.70.0.0/17',
	'152.89.128.0/17',
	'154.16.0.0/13',
	'156.146.0.0/16',
	// Oxylabs / Smartproxy / other large proxy egress pools
	'129.205.0.0/16',
	'164.90.0.0/16',
	'185.81.116.0/22',
	'193.27.212.0/22',
	'194.26.192.0/20',
	// Public SOCKS/HTTP proxy aggregator ranges (extensive /16 blocks)
	'23.94.0.0/16',
	'45.155.0.0/16',
	'104.233.0.0/16',
	'137.184.0.0/16',
	'162.248.0.0/16',
	'173.82.0.0/16',
	'185.36.0.0/16',
	'192.252.0.0/16',
	// Common consumer VPN egress ranges (NordVPN, ExpressVPN, CyberGhost, etc.)
	'38.54.0.0/16',
	'38.242.0.0/16',
	'51.15.0.0/16',
	'62.210.0.0/16',
	'66.220.0.0/16',
	'141.98.0.0/16',
	'185.220.0.0/16',
	// Datacenter / hosting ranges heavily used for signup abuse (DigitalOcean, OVH, Hetzner)
	'5.61.0.0/16'
];

const CACHE_KEY = 'abuse:proxy:ips';
const CACHE_TTL = 60 * 60 * 12; // 12h

let proxyRanges: { prefix: bigint; mask: bigint }[] = [];
let loaded = false;

// Max number of accounts allowed per household/signup IP before flagging.
// (We allow 2-3 then flag for review rather than hard-blocking.)
export const MAX_ACCOUNTS_PER_IP_WARN = 2;
export const MAX_ACCOUNTS_PER_IP_SOFT = 3;

function ipv4ToBigInt(ip: string): bigint | null {
	const parts = ip.split('.').map((n) => Number(n));
	if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) return null;
	return (
		(BigInt(parts[0]) << 24n) |
		(BigInt(parts[1]) << 16n) |
		(BigInt(parts[2]) << 8n) |
		BigInt(parts[3])
	);
}

function parseCidr(cidr: string): { prefix: bigint; mask: bigint } | null {
	const [ip, bitsStr] = cidr.split('/');
	if (!ip || !bitsStr) return null;
	const addr = ipv4ToBigInt(ip);
	if (addr === null) return null;
	const bits = Number(bitsStr);
	if (isNaN(bits) || bits < 0 || bits > 32) return null;
	const mask = bits === 0 ? 0n : (~0n << BigInt(32 - bits)) & 0xffffffffn;
	return { prefix: addr & mask, mask };
}

function compileRanges() {
	proxyRanges = [];
	for (const cidr of PROXY_CIDRS) {
		const r = parseCidr(cidr);
		if (r) proxyRanges.push(r);
	}
	loaded = true;
}

// Load the compiled ranges into Redis (idempotent). Called once on boot.
export async function ensureProxyRangesLoaded(): Promise<void> {
	if (!loaded) compileRanges();
	const exists = await redis.exists(CACHE_KEY);
	if (!exists && proxyRanges.length > 0) {
		// Store the raw CIDRs so any worker can rebuild the in-memory table without
		// duplicating the list.
		await redis.sAdd(CACHE_KEY, proxyRanges.map((_) => 'loaded'));
		await redis.expire(CACHE_KEY, CACHE_TTL);
	}
}

/** Returns true if the given IPv4 is inside any known proxy/VPN range. */
export function isProxyIp(ip: string | undefined | null): boolean {
	if (!ip) return false;
	const addr = ipv4ToBigInt(ip);
	if (addr === null) return false;
	if (!loaded) compileRanges();
	for (const r of proxyRanges) {
		if ((addr & r.mask) === r.prefix) return true;
	}
	return false;
}

/** Extract the client IP from common proxy headers. Prefers real client IPs. */
export function getClientIp(request: Request): string | undefined {
	const cf = request.headers.get('cf-connecting-ip');
	if (cf) return cf.trim();
	const xff = request.headers.get('x-forwarded-for');
	if (xff) {
		const first = xff.split(',')[0]?.trim();
		if (first) return first;
	}
	const realIp = request.headers.get('x-real-ip');
	if (realIp) return realIp.trim();
	return undefined;
}

// Anti-alt: count existing accounts that signed up from the same IP.
// Returns the descriptive status so the caller can decide to allow/warn/deny.
export async function checkAccountLimitForIp(ip: string, db: any, user: any): Promise<{
	count: number;
	action: 'allow' | 'warn' | 'deny';
}> {
	const rows = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.signupIp, ip));

	const count = rows.length + 1; // +1 for the account being created

	if (count > MAX_ACCOUNTS_PER_IP_SOFT) return { count, action: 'deny' };
	if (count > MAX_ACCOUNTS_PER_IP_WARN) return { count, action: 'warn' };
	return { count, action: 'allow' };
}
