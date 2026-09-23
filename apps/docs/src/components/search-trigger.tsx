"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { SearchIcon } from "lucide-react";
import { Fragment, type ComponentProps } from "react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * The header's search field: a quiet, borderless fill that reads as a field
 * without drawing a box, with the shortcut shown as one shadcn `Kbd` inset. It opens
 * the same Fumadocs search dialog the stock trigger does.
 */
export function SearchTrigger({
  className,
  ...props
}: ComponentProps<"button">) {
  const { enabled, hotKey, dialogHandle } = useSearchContext();
  if (!enabled) return null;

  return (
    <Dialog.Trigger
      handle={dialogHandle}
      type="button"
      data-search-full=""
      {...props}
      className={cn(
        "group inline-flex h-8 items-center gap-2 rounded-md bg-fd-secondary px-2.5 text-sm text-fd-muted-foreground transition-colors",
        "hover:bg-fd-accent hover:text-fd-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring",
        className,
      )}
    >
      <SearchIcon className="size-3.5 shrink-0" aria-hidden />
      <span>Search</span>
      <Kbd className="ms-auto bg-fd-background px-1.5 tracking-wide text-fd-muted-foreground group-hover:bg-fd-background/70">
        {hotKey.map((hotKey) => (
          <Fragment key={String(hotKey.key)}>{hotKey.display}</Fragment>
        ))}
      </Kbd>
    </Dialog.Trigger>
  );
}
