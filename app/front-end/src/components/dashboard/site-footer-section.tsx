const footerLinks = [
	{
		label: "萌ICP备20260415号",
		href: "https://icp.gov.moe/?keyword=20260415",
	},
	{
		label: "GitHub",
		href: "https://github.com/meorionel/am-i-okay",
	},
	{
		label: "我的博客",
		href: "https://blog.meorion.moe/",
	}
];

export function SiteFooterSection() {
	return (
		<footer className="mt-16 pb-4 sm:mt-20">
			<p className="text-[11px] font-semibold tracking-[0.28em] text-stone-400 uppercase sm:text-xs">一些信息</p>
			<ul className="mt-4 list-disc pl-5 marker:text-stone-300">
				{footerLinks.map((link) => (
					<li key={link.href} className="text-xs leading-6 text-stone-400 sm:text-sm">
						<a href={link.href} target="_blank" rel="noreferrer" className="transition hover:text-stone-500">
							{link.label}
						</a>
					</li>
				))}
			</ul>
		</footer>
	);
}
