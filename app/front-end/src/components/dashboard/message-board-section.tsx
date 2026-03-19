"use client";

import Link from "next/link";

export function MessageBoardSection() {
	return (
		<section className="mt-6">
			<Link
				href="/guestbook"
				className="text-sm leading-7 text-stone-500 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-700 hover:decoration-stone-500"
			>
				看看留言板
			</Link>
		</section>
	);
}
