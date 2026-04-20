"use client";

import { useEffect, useState } from "react";
import { gooeyToast } from "goey-toast";
import { PageLoading } from "../loading";
import { GuestbookComposer } from "@/src/components/guestbook/guestbook-composer";
import { GuestbookHeader } from "@/src/components/guestbook/guestbook-header";
import { GuestbookTimeline } from "@/src/components/guestbook/guestbook-timeline";
import { PageGateScreen } from "@/src/components/human/page-gate-screen";
import { useHumanGate } from "@/src/hooks/use-human-gate";
import { createGuestbookMessage, fetchGuestbookMessages } from "@/src/lib/api";
import { solveHumanChallenge } from "@/src/lib/human-gate";
import type { GuestbookMessage } from "@/src/types/guestbook";

const PAGE_SIZE = 20;
const COOLDOWN_STORAGE_KEY = "amiokay_guestbook_cooldown_until";

export default function GuestbookPage() {
	const { isVerified, isShowingSuccess, isCheckingStatus, progress, errorMessage, pageId, verify } = useHumanGate();
	const [draft, setDraft] = useState("");
	const [messages, setMessages] = useState<GuestbookMessage[]>([]);
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(0);
	const [isLoading, setIsLoading] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const rawValue = window.localStorage.getItem(COOLDOWN_STORAGE_KEY);
		if (!rawValue) {
			return;
		}

		const nextAllowedAt = new Date(rawValue).getTime();
		if (!Number.isFinite(nextAllowedAt)) {
			window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
			return;
		}

		setCooldownRemainingMs(Math.max(0, nextAllowedAt - Date.now()));
	}, []);

	useEffect(() => {
		if (cooldownRemainingMs <= 0) {
			if (typeof window !== "undefined") {
				window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
			}
			return;
		}

		const timer = window.setInterval(() => {
			setCooldownRemainingMs((current) => {
				if (current <= 1_000) {
					window.clearInterval(timer);
					window.localStorage.removeItem(COOLDOWN_STORAGE_KEY);
					return 0;
				}

				return current - 1_000;
			});
		}, 1_000);

		return () => {
			window.clearInterval(timer);
		};
	}, [cooldownRemainingMs]);

	const syncCooldown = (nextAllowedAt: string): void => {
		const nextAllowedAtMs = new Date(nextAllowedAt).getTime();
		if (!Number.isFinite(nextAllowedAtMs)) {
			return;
		}

		setCooldownRemainingMs(Math.max(0, nextAllowedAtMs - Date.now()));
		if (typeof window !== "undefined") {
			window.localStorage.setItem(COOLDOWN_STORAGE_KEY, new Date(nextAllowedAtMs).toISOString());
		}
	};

	useEffect(() => {
		if (!isVerified) {
			return;
		}

		let isActive = true;

		const loadMessages = async (): Promise<void> => {
			setIsLoading(true);
			try {
				const response = await fetchGuestbookMessages(pageId, page, PAGE_SIZE);
				if (!isActive) {
					return;
				}

				setMessages(response.items);
				setTotalPages(response.totalPages);
			} catch (error) {
				if (!isActive) {
					return;
				}

				gooeyToast.error(error instanceof Error ? error.message : String(error), { duration: 3200 });
			} finally {
				if (isActive) {
					setIsLoading(false);
				}
			}
		};

		void loadMessages();

		return () => {
			isActive = false;
		};
	}, [isVerified, page, pageId]);

	const submitMessage = async (): Promise<void> => {
		if (isSending) {
			return;
		}

		if (cooldownRemainingMs > 0) {
			gooeyToast.warning("留言冷却中，请稍后再试。", { duration: 2200 });
			return;
		}

		const body = draft.trim();
		if (!body) {
			gooeyToast.warning("先写点什么再发送吧。", { duration: 2200 });
			return;
		}

		if (body.length > 20) {
			gooeyToast.warning("留言最多 20 个字。", { duration: 2200 });
			return;
		}

		setIsSending(true);
		try {
			const humanToken = await solveHumanChallenge("/api/human/message");
			const response = await createGuestbookMessage(pageId, body, humanToken);
			syncCooldown(response.nextAllowedAt);
			setDraft("");
			if (page !== 1) {
				setPage(1);
			} else {
				const refreshed = await fetchGuestbookMessages(pageId, 1, PAGE_SIZE);
				setMessages(refreshed.items);
				setTotalPages(refreshed.totalPages);
			}
		} catch (error) {
			gooeyToast.error(error instanceof Error ? error.message : String(error), { duration: 3200 });
		} finally {
			setIsSending(false);
		}
	};

	if (isCheckingStatus) {
		return <PageLoading />;
	}

	if (!isVerified) {
		return <PageGateScreen status={errorMessage ? "failed" : "verifying"} progress={progress} errorMessage={errorMessage} onVerify={verify} />;
	}

	if (isShowingSuccess) {
		return <PageGateScreen status="success" progress={100} errorMessage={null} onVerify={verify} />;
	}

	return (
		<main className="min-h-screen bg-[#f5f5f2] px-6 py-16 text-stone-700 sm:px-8 sm:py-24">
			<div className="mx-auto w-full max-w-2xl">
				<GuestbookHeader />
				<GuestbookComposer draft={draft} setDraft={setDraft} onSubmit={() => void submitMessage()} isSending={isSending} cooldownRemainingMs={cooldownRemainingMs} />
				<GuestbookTimeline
					messages={messages}
					isLoading={isLoading}
					page={page}
					totalPages={totalPages}
					onPrevPage={() => setPage((current) => Math.max(1, current - 1))}
					onNextPage={() => setPage((current) => current + 1)}
				/>
			</div>
		</main>
	);
}
