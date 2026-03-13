"use client";

import { useEffect, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";
import { FoodRateLimitError, fetchFoodCounter, feedFood } from "@/src/lib/api";
import type { FoodItem } from "@/src/types/activity";

const STORAGE_KEY = "amiokay.browser-fingerprint.v1";
const FEED_COOLDOWN_MS = 3_000;
const FOOD_POLL_INTERVAL_MS = 2_500;
const FOOD_FALL_DURATION_MS = 3_200;
const FOOD_DROP_LIFETIME_MS = FOOD_FALL_DURATION_MS;
const MAX_DROPS_PER_SYNC = 6;

export interface FallingFood {
	id: string;
	emoji: string;
	left: number;
	sizeRem: number;
	rotation: number;
	startY: number;
	endY: number;
}

interface FingerprintState {
	value: string;
	source: "header" | "body" | "derived";
}

function createFoodDrops(foods: FoodItem[], previousFoods: FoodItem[]): FallingFood[] {
	const previousById = new Map(previousFoods.map((food) => [food.id, food]));
	const drops: FallingFood[] = [];
	const viewportHeight = typeof window === "undefined" ? 900 : window.innerHeight;

	for (const food of foods) {
		const previousCount = previousById.get(food.id)?.totalCount ?? 0;
		const diff = Math.max(0, food.totalCount - previousCount);

		for (let index = 0; index < Math.min(diff, MAX_DROPS_PER_SYNC - drops.length); index += 1) {
			const sizeRem = 1.6 + Math.random() * 0.8;
			const sizePx = sizeRem * 16;

			drops.push({
				id: `${food.id}-${Date.now()}-${crypto.randomUUID()}`,
				emoji: food.emoji,
				left: 6 + Math.random() * 88,
				sizeRem,
				rotation: -140 + Math.random() * 280,
				startY: -(sizePx * 2.2),
				endY: viewportHeight + sizePx * 1.8,
			});
		}

		if (drops.length >= MAX_DROPS_PER_SYNC) {
			break;
		}
	}

	return drops;
}

function readStoredFingerprint(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return value && value.trim().length > 0 ? value : null;
	} catch {
		return null;
	}
}

function collectBrowserSeed(): string {
	if (typeof window === "undefined") {
		return "server";
	}

	return JSON.stringify({
		userAgent: window.navigator.userAgent,
		language: window.navigator.language,
		languages: window.navigator.languages,
		platform: window.navigator.platform,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		hardwareConcurrency: window.navigator.hardwareConcurrency ?? 0,
		colorDepth: window.screen.colorDepth,
		pixelDepth: window.screen.pixelDepth,
		width: window.screen.width,
		height: window.screen.height,
		pixelRatio: window.devicePixelRatio,
	});
}

async function sha256(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateFingerprint(): Promise<string> {
	const stored = readStoredFingerprint();
	if (stored) {
		return stored;
	}

	const generated = await sha256(collectBrowserSeed());

	try {
		window.localStorage.setItem(STORAGE_KEY, generated);
	} catch {
		// Ignore storage failures and keep the in-memory fingerprint.
	}

	return generated;
}

export function useFoodCounter(): {
	foods: FoodItem[];
	fallingFoods: FallingFood[];
	isLoading: boolean;
	isSubmitting: boolean;
	activeFoodId: number | null;
	fingerprint: FingerprintState | null;
	feed: (foodId: number) => Promise<void>;
} {
	const [foods, setFoods] = useState<FoodItem[]>([]);
	const [fallingFoods, setFallingFoods] = useState<FallingFood[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeFoodId, setActiveFoodId] = useState<number | null>(null);
	const [fingerprint, setFingerprint] = useState<FingerprintState | null>(null);
	const fingerprintRef = useRef<string | null>(null);
	const lastFeedAttemptAtRef = useRef<number>(0);
	const foodsRef = useRef<FoodItem[]>([]);

	const spawnDrops = (nextFoods: FoodItem[], previousFoods: FoodItem[]): void => {
		const nextDrops = createFoodDrops(nextFoods, previousFoods);
		if (nextDrops.length === 0) {
			return;
		}

		setFallingFoods((current) => [...current, ...nextDrops]);

		window.setTimeout(() => {
			setFallingFoods((current) =>
				current.filter((drop) => !nextDrops.some((nextDrop) => nextDrop.id === drop.id)),
			);
		}, FOOD_DROP_LIFETIME_MS);
	};

	useEffect(() => {
		let isActive = true;

		const bootstrap = async (): Promise<void> => {
			try {
				const nextFingerprint = await getOrCreateFingerprint();
				if (!isActive) {
					return;
				}

				fingerprintRef.current = nextFingerprint;
				const response = await fetchFoodCounter(nextFingerprint);
				if (!isActive) {
					return;
				}

				setFoods(response.foods);
				foodsRef.current = response.foods;
				setFingerprint({
					value: response.viewerFingerprint || nextFingerprint,
					source: response.fingerprintSource,
				});
			} catch (error) {
				console.warn("[food] failed to bootstrap counter", error);
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		void bootstrap();

		const pollTimer = window.setInterval(() => {
			const currentFingerprint = fingerprintRef.current;
			if (!isActive || !currentFingerprint) {
				return;
			}

			void fetchFoodCounter(currentFingerprint)
				.then((response) => {
					if (!isActive) {
						return;
					}

					const previousFoods = foodsRef.current;
					if (previousFoods.length > 0) {
						spawnDrops(response.foods, previousFoods);
					}

					foodsRef.current = response.foods;
					setFoods(response.foods);
					setFingerprint({
						value: response.viewerFingerprint || currentFingerprint,
						source: response.fingerprintSource,
					});
				})
				.catch((error) => {
					console.warn("[food] failed to poll counter", error);
				});
		}, FOOD_POLL_INTERVAL_MS);

		return () => {
			isActive = false;
			window.clearInterval(pollTimer);
		};
	}, []);

	const feed = async (foodId: number): Promise<void> => {
		if (isSubmitting) {
			return;
		}

		if (Date.now() - lastFeedAttemptAtRef.current < FEED_COOLDOWN_MS) {
			gooeyToast.warning("你点太快了!", {
				duration: 2200,
			});
			return;
		}

		const currentFingerprint = fingerprintRef.current ?? (await getOrCreateFingerprint());
		fingerprintRef.current = currentFingerprint;
		lastFeedAttemptAtRef.current = Date.now();

		setIsSubmitting(true);
		setActiveFoodId(foodId);

		try {
			const response = await feedFood(foodId, currentFingerprint);
			const previousFoods = foodsRef.current;
			setFoods(response.foods);
			foodsRef.current = response.foods;
			setFingerprint({
				value: response.viewerFingerprint || currentFingerprint,
				source: response.fingerprintSource,
			});
			spawnDrops(response.foods, previousFoods);

			const activeFood = response.foods.find((item) => item.id === foodId);
			if (activeFood?.viewerCount === 1) {
				gooeyToast.success(`你投喂了一个 ${activeFood.emoji} , 谢谢你`, {
					duration: 2400,
				});
			}
		} catch (error) {
			if (error instanceof FoodRateLimitError) {
				gooeyToast.warning("你太快了!", {
					duration: 2200,
				});
				return;
			}

			console.warn(`[food] failed to feed id=${foodId}`, error);
		} finally {
			setIsSubmitting(false);
			setActiveFoodId(null);
		}
	};

	return {
		foods,
		fallingFoods,
		isLoading,
		isSubmitting,
		activeFoodId,
		fingerprint,
		feed,
	};
}
