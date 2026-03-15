import type { NextConfig } from "next";

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, "");
}

function addConnectSrcVariants(values: Set<string>, protocol: string, host: string): void {
	values.add(`${protocol}//${host}`);

	if (protocol === "http:") {
		values.add(`ws://${host}`);
		return;
	}

	if (protocol === "https:") {
		values.add(`wss://${host}`);
		return;
	}

	if (protocol === "ws:") {
		values.add(`http://${host}`);
		return;
	}

	if (protocol === "wss:") {
		values.add(`https://${host}`);
	}
}

function getConnectSrcValues(): string {
	const values = new Set<string>(["'self'"]);
	values.add("https://cdn.jsdelivr.net");

	const internalBaseUrl = process.env.BACKEND_INTERNAL_API_BASE_URL?.trim();
	const publicWsBaseUrl = process.env.BACKEND_PUBLIC_WS_BASE_URL?.trim();

	for (const candidate of [internalBaseUrl, publicWsBaseUrl]) {
		if (!candidate) {
			continue;
		}

		try {
			const url = new URL(trimTrailingSlash(candidate));
			addConnectSrcVariants(values, url.protocol, url.host);

			if (url.hostname === "127.0.0.1") {
				addConnectSrcVariants(values, url.protocol, `localhost:${url.port}`);
			} else if (url.hostname === "localhost") {
				addConnectSrcVariants(values, url.protocol, `127.0.0.1:${url.port}`);
			}
		} catch {
			continue;
		}
	}

	return Array.from(values).join(" ");
}

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"img-src 'self' data: blob:",
			"style-src 'self' 'unsafe-inline'",
			"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			"worker-src 'self' blob:",
			"child-src 'self' blob:",
			"font-src 'self' data:",
			`connect-src ${getConnectSrcValues()}`,
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
		].join("; "),
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
];

const nextConfig: NextConfig = {
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
