"use client";

import type { FallingFood } from "@/src/hooks/use-food-counter";

interface FoodFallOverlayProps {
	foods: FallingFood[];
}

export function FoodFallOverlay({ foods }: FoodFallOverlayProps) {
	if (foods.length === 0) {
		return null;
	}

	return (
		<div className="food-fall-overlay" aria-hidden="true">
			{foods.map((food) => (
				<span
					key={food.id}
					className="food-fall-item"
					style={{
						left: `${food.left}%`,
						fontSize: `${food.sizeRem}rem`,
						["--food-rotate" as string]: `${food.rotation}deg`,
						["--food-start-y" as string]: `${food.startY}px`,
						["--food-end-y" as string]: `${food.endY}px`,
					}}
				>
					{food.emoji}
				</span>
			))}
		</div>
	);
}
