import Link from "next/link";

export function GuestbookHeader() {
	return (
		<header className="mb-16">
			<h1 className="font-(family-name:--font-editorial) text-[2.4rem] font-light tracking-[-0.05em] text-stone-800 sm:text-[3.2rem]">Guestbook</h1>
			<Link href="/" className="mt-4 inline-flex text-[11px] uppercase tracking-[0.34em] text-stone-400 transition hover:text-stone-600">
				←Back
			</Link>
		</header>
	);
}
