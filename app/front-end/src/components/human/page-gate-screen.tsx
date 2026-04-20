"use client";

import Image from "next/image";

interface PageGateScreenProps {
	status?: "verifying" | "success" | "failed";
	progress?: number;
	errorMessage: string | null;
	onVerify: () => Promise<void>;
}

const IMAGE_BY_STATUS: Record<NonNullable<PageGateScreenProps["status"]>, string> = {
	verifying: "/2.png",
	success: "/1.png",
	failed: "/3.png",
};

const LABEL_BY_STATUS: Record<NonNullable<PageGateScreenProps["status"]>, string> = {
	verifying: "验证中",
	success: "验证成功",
	failed: "验证失败",
};

const TITLE_BY_STATUS: Record<NonNullable<PageGateScreenProps["status"]>, string> = {
	verifying: "正在确认你是不是机器人！",
	success: "验证通过，正在进入页面",
	failed: "验证没有通过，请再试一次",
};

const DESCRIPTION_BY_STATUS: Record<NonNullable<PageGateScreenProps["status"]>, string> = {
	verifying: "请稍等，我们需要在继续之前检查您的连接安全性。",
	success: "验证已完成，页面正在为你准备内容。",
	failed: "请重新进行一次人机验证，我们会在通过后自动继续。",
};

function resolveStatus(status: PageGateScreenProps["status"], errorMessage: string | null): NonNullable<PageGateScreenProps["status"]> {
	if (status) {
		return status;
	}

	return errorMessage ? "failed" : "verifying";
}

export function PageGateScreen({
	status,
	progress = 0,
	errorMessage,
	onVerify,
}: PageGateScreenProps) {
	const currentStatus = resolveStatus(status, errorMessage);
	const imageSrc = IMAGE_BY_STATUS[currentStatus];
	const label = LABEL_BY_STATUS[currentStatus];
	const title = TITLE_BY_STATUS[currentStatus];
	const description = DESCRIPTION_BY_STATUS[currentStatus];
	const progressValue = Math.max(0, Math.min(100, Math.round(currentStatus === "success" ? 100 : currentStatus === "failed" ? progress : progress)));

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f5f5f2] px-6 py-10 text-stone-800">
			<div className="flex w-full max-w-5xl flex-col items-center justify-center px-8 py-14 sm:px-12">
				<h1 className="text-center font-[family-name:var(--font-editorial)] text-4xl leading-tight text-stone-900 sm:text-5xl">
					{title}
				</h1>
				<Image
					src={imageSrc}
					alt={label}
					width={960}
					height={960}
					priority
					className="mt-10 h-auto w-full max-w-[12rem] object-contain sm:max-w-[14rem]"
				/>
				<p className="mt-5 text-center text-2xl font-semibold text-stone-900">{currentStatus === "verifying" ? "加载中..." : label}</p>
				<div className="mt-6 w-full max-w-md">
					<div className="h-3 overflow-hidden rounded-full bg-stone-900/10">
						<div
							className="h-full rounded-full bg-stone-800 transition-[width] duration-300"
							style={{ width: `${Math.max(progressValue, currentStatus === "verifying" ? 8 : 0)}%` }}
						/>
					</div>
					<p className="mt-2 text-center text-sm text-stone-500">{progressValue}%</p>
				</div>
				<p className="mt-7 max-w-2xl text-center text-lg leading-8 text-stone-700">{description}</p>
				{errorMessage ? <p className="mt-4 max-w-2xl text-center text-sm text-rose-700">失败原因：{errorMessage}</p> : null}
				<p className="mt-8 max-w-3xl text-center text-base leading-8 text-stone-600">
					本页面正在进行自动人机验证。验证成功后会自动跳转，若失败可手动重新发起验证。
				</p>
				{errorMessage ? (
					<button
						type="button"
						onClick={() => void onVerify()}
						className="mt-5 inline-flex items-center justify-center rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
					>
						重新验证
					</button>
				) : null}
			</div>
		</main>
	);
}
