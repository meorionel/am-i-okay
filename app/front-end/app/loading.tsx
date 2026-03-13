export function PageLoading() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f5f5f0]">
			<div
				aria-label="Loading"
				className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-500"
				role="status"
			/>
		</main>
	);
}

export default function Loading() {
	return <PageLoading />;
}
