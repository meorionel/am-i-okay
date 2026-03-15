"use client";

import { FoodFallOverlay } from "@/src/components/dashboard/food-fall-overlay";
import { useFoodCounter } from "@/src/hooks/use-food-counter";

function formatCount(value: number): string {
	return new Intl.NumberFormat("en-US").format(value);
}

export function FoodCounterSection({ enabled, pageId }: { enabled: boolean; pageId: string }) {
	const { foods, fallingFoods, isLoading, isSubmitting, activeFoodId, feed } = useFoodCounter(enabled, pageId);

	if (!isLoading && foods.length === 0) {
		return null;
	}

	return (
		<section className="mt-7">
			<FoodFallOverlay foods={fallingFoods} />
			<div className="flex flex-wrap items-center gap-x-4 gap-y-3 sm:gap-x-5 sm:gap-y-4">
				{(isLoading ? Array.from({ length: 13 }, (_, index) => index + 1) : foods).map((food) => {
					const item = typeof food === "number" ? null : food;
					const key = typeof food === "number" ? food : food.id;
					const isActive = item?.id === activeFoodId;
					const count = item?.totalCount ?? 0;

					return (
						<button
							key={key}
							type="button"
							onClick={item ? () => void feed(item.id) : undefined}
							disabled={!item || isSubmitting}
							className={[
								"group inline-flex items-center gap-1.5 rounded-full px-0.5 py-0.5 text-stone-400 transition duration-200",
								item ? "cursor-pointer hover:text-stone-500" : "cursor-wait opacity-60",
								isActive ? "scale-[0.96]" : "scale-100",
							].join(" ")}
							aria-label={item ? `${item.viewerCount > 0 ? "取消投喂" : "投喂"} ${item.emoji}` : "加载食物计数"}
						>
							<span
								className={[
									"text-lg leading-none transition duration-200",
									item?.viewerCount ? "drop-shadow-[0_5px_12px_rgba(245,158,11,0.14)]" : "",
									isActive ? "translate-y-px" : "group-hover:-translate-y-0.5",
								].join(" ")}
							>
								{item?.emoji ?? "·"}
							</span>
							<span className="min-w-4 text-sm font-light tabular-nums text-stone-400">{formatCount(count)}</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}
