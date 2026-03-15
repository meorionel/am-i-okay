"use client";

import { createRandomId } from "@/src/lib/random";

interface CapSolveProgressListener {
	(event: CustomEvent<{ progress: number }>): void;
}

interface CapSolveErrorListener {
	(event: CustomEvent<{ message: string }>): void;
}

interface CapSolveResult {
	success: boolean;
	token: string;
}

interface CapController {
	widget?: HTMLElement;
	solve(): Promise<CapSolveResult>;
	reset(): void;
	addEventListener(type: "progress", listener: CapSolveProgressListener): void;
	addEventListener(type: "error", listener: CapSolveErrorListener): void;
}

type CapConstructor = new (config?: { apiEndpoint?: string }, el?: HTMLElement) => CapController;

let humanPageId = "";
let capConstructorPromise: Promise<CapConstructor> | null = null;

function toErrorMessage(error: unknown): string {
	if (error instanceof Error && error.message) {
		return error.message;
	}

	if (typeof error === "string" && error.length > 0) {
		return error;
	}

	try {
		return JSON.stringify(error);
	} catch {
		return "Unknown error";
	}
}

async function waitForWidgetReady(host: HTMLElement): Promise<void> {
	if (!host.isConnected) {
		await new Promise<void>((resolve) => {
			queueMicrotask(resolve);
		});
	}

	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
}

function ensureCapConstructor(): Promise<CapConstructor> {
	if (!capConstructorPromise) {
		capConstructorPromise = import("@cap.js/widget").then((mod) => {
			const ctor = "default" in mod ? mod.default : mod;
			return ctor as unknown as CapConstructor;
		});
	}

	return capConstructorPromise;
}

export function getHumanPageId(): string {
	if (typeof window === "undefined") {
		return "";
	}

	if (!humanPageId) {
		humanPageId = createRandomId();
	}

	return humanPageId;
}

export async function solveHumanChallenge(
	apiEndpoint: string,
	events?: {
		onProgress?: (progress: number) => void;
	},
): Promise<string> {
	const CapWidget = await ensureCapConstructor();
	const controller = new CapWidget({ apiEndpoint });
	const host = controller.widget;

	if (!host) {
		throw new Error("cap widget did not initialize correctly");
	}

	await waitForWidgetReady(host);

	const progressListener: CapSolveProgressListener = (event) => {
		events?.onProgress?.(event.detail.progress);
	};
	const errorListener: CapSolveErrorListener = (event) => {
		console.warn(`[human-gate] cap widget error: ${event.detail.message}`);
	};

	host.addEventListener("progress", progressListener as EventListener);
	host.addEventListener("error", errorListener as EventListener);

	try {
		const result = await controller.solve();
		if (!result?.success || !result.token) {
			throw new Error("cap challenge did not return a token");
		}

		return result.token;
	} catch (error) {
		const message = toErrorMessage(error);
		console.warn("[human-gate] cap solve failed", error);
		throw new Error(`cap challenge failed: ${message}`);
	} finally {
		host.removeEventListener("progress", progressListener as EventListener);
		host.removeEventListener("error", errorListener as EventListener);
		controller.reset();
		host.remove();
	}
}
