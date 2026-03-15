"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { getHumanPageId, solveHumanChallenge } from "@/src/lib/human-gate";

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

export function useHumanGate(): {
	isVerified: boolean;
	isCheckingStatus: boolean;
	isVerifying: boolean;
	progress: number;
	errorMessage: string | null;
	pageId: string;
	verify: () => Promise<void>;
} {
	const [pageId] = useState(() => getHumanPageId());
	const [isVerified, setIsVerified] = useState(false);
	const [isCheckingStatus, setIsCheckingStatus] = useState(true);
	const [isVerifying, setIsVerifying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const hasAutoStartedRef = useRef(false);

	const verify = async (): Promise<void> => {
		if (isVerifying) {
			return;
		}

		setIsVerifying(true);
		setProgress(0);
		setErrorMessage(null);

		try {
			const token = await solveHumanChallenge("/api/human/page", {
				onProgress: (nextProgress) => setProgress(nextProgress),
			});

			const response = await fetch("/api/human/page/verify", {
				method: "POST",
				cache: "no-store",
				headers: {
					"content-type": "application/json",
					"x-human-page-id": pageId,
				},
				body: JSON.stringify({ token }),
			});

			if (!response.ok) {
				throw new Error(`page verification failed with HTTP ${response.status}`);
			}

			setProgress(100);
			setIsVerified(true);
		} catch (error) {
			setErrorMessage(toErrorMessage(error));
			setProgress(0);
			throw error;
		} finally {
			setIsVerifying(false);
		}
	};

	const autoVerify = useEffectEvent(() => {
		void verify().catch(() => {
			// The error is already surfaced through state for the gate UI.
		});
	});

	useEffect(() => {
		let isActive = true;

		const checkStatus = async (): Promise<void> => {
			try {
				const response = await fetch("/api/human/page/status", {
					method: "GET",
					cache: "no-store",
					headers: {
						accept: "application/json",
					},
				});

				if (!response.ok) {
					return;
				}

				const data = (await response.json()) as { verified?: boolean };
				if (isActive && data.verified === true) {
					setIsVerified(true);
					setProgress(100);
				}
			} catch {
				// Ignore and fall back to auto verification.
			} finally {
				if (isActive) {
					setIsCheckingStatus(false);
				}
			}
		};

		void checkStatus();

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		if (isCheckingStatus || hasAutoStartedRef.current || isVerified || isVerifying) {
			return;
		}

		hasAutoStartedRef.current = true;
		autoVerify();
	}, [isCheckingStatus, isVerified, isVerifying]);

	return {
		isVerified,
		isCheckingStatus,
		isVerifying,
		progress,
		errorMessage,
		pageId,
		verify,
	};
}
