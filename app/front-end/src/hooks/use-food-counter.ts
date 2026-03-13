"use client";

import { useEffect, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";
import { FoodRateLimitError, fetchFoodCounter, feedFood } from "@/src/lib/api";
import type { FoodItem } from "@/src/types/activity";

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

export function useFoodCounter(): {
	foods: FoodItem[];
	fallingFoods: FallingFood[];
	isLoading: boolean;
	isSubmitting: boolean;
	activeFoodId: number | null;
	feed: (foodId: number) => Promise<void>;
} {
	const [foods, setFoods] = useState<FoodItem[]>([]);
	const [fallingFoods, setFallingFoods] = useState<FallingFood[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [activeFoodId, setActiveFoodId] = useState<number | null>(null);
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
				const response = await fetchFoodCounter("");
				if (!isActive) {
					return;
				}

				setFoods(response.foods);
				foodsRef.current = response.foods;
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
			if (!isActive) {
				return;
			}

			void fetchFoodCounter("")
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

		lastFeedAttemptAtRef.current = Date.now();

		setIsSubmitting(true);
		setActiveFoodId(foodId);

		try {
			const response = await feedFood(foodId, "");
			const previousFoods = foodsRef.current;
			setFoods(response.foods);
			foodsRef.current = response.foods;
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
		feed,
	};
}
