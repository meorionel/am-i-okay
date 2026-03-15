"use client";

import { useEffect, useRef, useState } from "react";
import { gooeyToast } from "goey-toast";
import { solveHumanChallenge } from "@/src/lib/human-gate";
import { FoodRateLimitError, fetchFoodCounter, feedFood } from "@/src/lib/api";
import { parseFoodSocketMessage, type FoodItem } from "@/src/types/activity";

const FEED_COOLDOWN_MS = 3_000;
const FOOD_FALL_DURATION_MS = 3_200;
const FOOD_DROP_LIFETIME_MS = FOOD_FALL_DURATION_MS;
const MAX_DROPS_PER_SYNC = 6;
const FOOD_SOCKET_RETRY_MS = 2_000;

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

export function useFoodCounter(enabled: boolean, pageId: string): {
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
		if (!enabled) {
			setFoods([]);
			foodsRef.current = [];
			setFallingFoods([]);
			setIsLoading(true);
			return;
		}

		let isActive = true;
		let reconnectTimer: number | null = null;
		let socket: WebSocket | null = null;

		const applyFoods = (nextFoods: FoodItem[]): void => {
			const previousFoods = foodsRef.current;
			if (previousFoods.length > 0) {
				spawnDrops(nextFoods, previousFoods);
			}

			foodsRef.current = nextFoods;
			setFoods(nextFoods);
		};

		const connectSocket = async (): Promise<void> => {
			try {
				const response = await fetch("/api/dashboard/food/socket", {
					method: "GET",
					cache: "no-store",
					headers: {
						Accept: "application/json",
						"x-human-page-id": pageId,
					},
				});

				if (!isActive) {
					return;
				}

				if (!response.ok) {
					throw new Error(`food socket bootstrap failed with HTTP ${response.status}`);
				}

				const data = (await response.json()) as { url?: string };
				if (!data.url) {
					throw new Error("food socket bootstrap did not return a websocket url");
				}

				socket = new WebSocket(data.url);
				socket.onmessage = (event) => {
					if (!isActive) {
						return;
					}

					try {
						const message = parseFoodSocketMessage(JSON.parse(event.data));
						if (!message) {
							return;
						}

						if (message.type === "error") {
							console.warn(`[food-ws] ${message.payload.message}`);
							return;
						}

						applyFoods(message.payload.foods);
					} catch (error) {
						console.warn("[food-ws] failed to parse websocket payload", error);
					}
				};
				socket.onclose = () => {
					if (!isActive) {
						return;
					}

					reconnectTimer = window.setTimeout(() => {
						void connectSocket();
					}, FOOD_SOCKET_RETRY_MS);
				};
				socket.onerror = (error) => {
					console.warn("[food-ws] websocket error", error);
				};
			} catch (error) {
				console.warn("[food-ws] failed to establish websocket", error);
				if (isActive) {
					reconnectTimer = window.setTimeout(() => {
						void connectSocket();
					}, FOOD_SOCKET_RETRY_MS);
				}
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		const bootstrap = async (): Promise<void> => {
			try {
				const response = await fetchFoodCounter(pageId);
				if (!isActive) {
					return;
				}

				foodsRef.current = response.foods;
				setFoods(response.foods);
			} catch (error) {
				console.warn("[food] failed to bootstrap counter", error);
			}

			void connectSocket();
		};

		void bootstrap();

		return () => {
			isActive = false;
			if (reconnectTimer !== null) {
				window.clearTimeout(reconnectTimer);
			}
			socket?.close();
		};
	}, [enabled, pageId]);

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
			const operation = (async () => {
				const humanToken = await solveHumanChallenge("/api/human/feed");
				const response = await feedFood(pageId, foodId, humanToken);
				const activeFood = response.foods.find((item) => item.id === foodId) ?? null;
				return {
					response,
					activeFood,
				};
			})();

			gooeyToast.promise(operation, {
				loading: "正在进行投喂...",
				success: ({ activeFood }) => {
					if (!activeFood) {
						return "投喂成功";
					}

					return activeFood.viewerCount > 0
						? `你投喂了一个 ${activeFood.emoji} , 谢谢你`
						: `你收回了一个 ${activeFood.emoji}`;
				},
				error: (error) => {
					if (error instanceof FoodRateLimitError) {
						return "你太快了!";
					}

					if (error instanceof Error && error.message.includes("HTTP 403")) {
						return "人机验证没有通过，请再试一次。";
					}

					return "投喂失败了，请稍后再试。";
				},
			});

			const { response } = await operation;
			const previousFoods = foodsRef.current;
			setFoods(response.foods);
			foodsRef.current = response.foods;
			spawnDrops(response.foods, previousFoods);
		} catch (error) {
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
