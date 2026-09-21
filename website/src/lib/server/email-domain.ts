import { resolveMx } from 'node:dns/promises';

// Validates that an email's domain actually exists / can receive mail by checking
// for MX records, with a short timeout so signup latency stays bounded. Only
// rejects when we're confident the domain has no mail exchange (or the TLD/name
// clearly can't exist). Uses the OS resolver via explicit DNS server list.
const LOCALHOST_DOMAINS = new Set([
	'localhost',
	'127.0.0.1',
	'0.0.0.0',
	'[::1]',
	'::1',
	'example.com',
	'example.net',
	'example.org',
	'foo.com',
	'bar.com'
]);

export async function hasMxRecords(domain: string): Promise<boolean> {
	const d = domain.trim().toLowerCase();
	if (!d || LOCALHOST_DOMAINS.has(d)) return false;
	if (d.split('.').length < 2) return false;
	// Basic structural guard: the domain must look like a hostname.
	if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(d)) {
		return false;
	}
	try {
		const mx = await Promise.race([
			resolveMx(d),
			new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))
		]);
		if (mx === null) {
			// Timeout: be lenient (can't confirm), don't block on flaky DNS.
			return true;
		}
		return mx.length > 0;
	} catch (e: any) {
		// ENOENT / ENOTFOUND / no MX records => domain isn't a real mail domain.
		if (e?.code === 'ENODATA' || e?.code === 'ENOTFOUND' || e?.code === 'ENOENT') {
			return false;
		}
		// Other resolver errors: be lenient.
		return true;
	}
}