import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Am I Okay",
	description: "A quiet reflection of your digital space.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">{children}</body>
		</html>
	);
}
