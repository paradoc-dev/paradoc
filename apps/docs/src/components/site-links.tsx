import type { ComponentProps } from "react";
import { useNotebookLayout } from "fumadocs-ui/layouts/notebook";
import { LinkItem } from "fumadocs-ui/layouts/shared";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteLinks(props: ComponentProps<"div">) {
	const { navItems } = useNotebookLayout();
	const unsupported = navItems.find((item) => item.type !== "icon");
	if (unsupported) {
		throw new Error(
			`Site links support icons only; got a "${unsupported.type}" link`,
		);
	}
	const iconLinks = navItems.filter(
		(item): item is Extract<(typeof navItems)[number], { type: "icon" }> =>
			item.type === "icon",
	);

	return (
		<div
			{...props}
			className={cn("flex shrink-0 items-center gap-1", props.className)}
		>
			{iconLinks.map((item) => (
				<LinkItem
					key={item.url}
					item={item}
					aria-label={item.label}
					className={cn(
						buttonVariants({ size: "icon-sm", variant: "ghost" }),
						"text-fd-muted-foreground hover:text-fd-foreground",
					)}
				>
					{item.icon}
				</LinkItem>
			))}
		</div>
	);
}
