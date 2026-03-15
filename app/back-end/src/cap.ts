import Cap from "@cap.js/server";

export type HumanChallengePurpose = "page" | "feed";

export interface HumanChallengePolicy {
	challengeCount: number;
	challengeSize: number;
	challengeDifficulty: number;
	expiresMs: number;
}

function parseInteger(value: string | undefined, fallback: number, min = 1): number {
	const parsed = Number(value);
	return Number.isInteger(parsed) && parsed >= min ? parsed : fallback;
}

function getPagePolicy(): HumanChallengePolicy {
	return {
		challengeCount: parseInteger(process.env.CAP_PAGE_CHALLENGE_COUNT, 20),
		challengeSize: parseInteger(process.env.CAP_PAGE_CHALLENGE_SIZE, 24),
		challengeDifficulty: parseInteger(process.env.CAP_PAGE_CHALLENGE_DIFFICULTY, 4),
		expiresMs: parseInteger(process.env.CAP_PAGE_EXPIRES_MS, 10 * 60_000, 1_000),
	};
}

function getFeedPolicy(): HumanChallengePolicy {
	return {
		challengeCount: parseInteger(process.env.CAP_FEED_CHALLENGE_COUNT, 8),
		challengeSize: parseInteger(process.env.CAP_FEED_CHALLENGE_SIZE, 20),
		challengeDifficulty: parseInteger(process.env.CAP_FEED_CHALLENGE_DIFFICULTY, 3),
		expiresMs: parseInteger(process.env.CAP_FEED_EXPIRES_MS, 2 * 60_000, 1_000),
	};
}

function createCapInstance(): Cap {
	return new Cap({
		noFSState: true,
		disableAutoCleanup: false,
		state: {
			challengesList: {},
			tokensList: {},
		},
	});
}

const capByPurpose: Record<HumanChallengePurpose, Cap> = {
	page: createCapInstance(),
	feed: createCapInstance(),
};

const policyByPurpose: Record<HumanChallengePurpose, HumanChallengePolicy> = {
	page: getPagePolicy(),
	feed: getFeedPolicy(),
};

export function getHumanChallengePolicy(purpose: HumanChallengePurpose): HumanChallengePolicy {
	return policyByPurpose[purpose];
}

export async function createHumanChallenge(purpose: HumanChallengePurpose): Promise<{
	challenge: { c: number; s: number; d: number };
	token?: string;
	expires: number;
}> {
	const policy = getHumanChallengePolicy(purpose);
	return await capByPurpose[purpose].createChallenge(policy);
}

export async function redeemHumanChallenge(
	purpose: HumanChallengePurpose,
	token: string,
	solutions: number[],
): Promise<{
	success: boolean;
	message?: string;
	token?: string;
	expires?: number;
}> {
	return await capByPurpose[purpose].redeemChallenge({
		token,
		solutions,
	});
}

export async function validateHumanToken(
	purpose: HumanChallengePurpose,
	token: string,
	options?: {
		keepToken?: boolean;
	},
): Promise<boolean> {
	const result = await capByPurpose[purpose].validateToken(token, {
		keepToken: options?.keepToken,
	});
	return result.success;
}
