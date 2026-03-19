import type { Metadata } from "next";
import "./globals.css";
import "goey-toast/styles.css";
import { GooeyToastProvider } from "@/src/components/gooey-toast-provider";

export const metadata: Metadata = {
	title: "Am I Okay",
	description: "A quiet reflection of your digital space.",
	icons: {
		icon: "/logo.png",
		shortcut: "/logo.png",
		apple: "/logo.png",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">
				{children}
				<GooeyToastProvider />
			</body>
		</html>
	);
}
