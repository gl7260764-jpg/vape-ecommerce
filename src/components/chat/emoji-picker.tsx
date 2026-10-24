"use client";

import type { ComponentProps, ReactNode } from "react";
import { EmojiPicker as Picker, type EmojiPickerListCategoryHeaderProps, type EmojiPickerListEmojiProps, type EmojiPickerListRowProps } from "frimousse";
import { Popover } from "radix-ui";
import { cn } from "@/lib/utils";

// frimousse, styled for the store. Emoji data is self-hosted under /public/emoji (emojibase-data 18, English).

function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div {...props} className="bg-popover px-3 pt-3 pb-1.5 text-xs font-medium text-muted-foreground">
      {category.label}
    </div>
  );
}

function Row({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div {...props} className="scroll-my-1.5 px-1.5">
      {children}
    </div>
  );
}

function Emoji({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button {...props} className="flex size-9 items-center justify-center rounded-xl text-[1.35rem] data-active:bg-surface-2">
      {emoji.emoji}
    </button>
  );
}

const LIST_COMPONENTS = { CategoryHeader, Row, Emoji };

export function EmojiPickerPanel({ onPick, className }: { onPick: (emoji: string) => void; className?: string }) {
  return (
    <Picker.Root
      emojibaseUrl="/emoji"
      columns={8}
      onEmojiSelect={({ emoji }) => onPick(emoji)}
      className={cn("isolate flex h-[22rem] w-[19.75rem] max-w-[calc(100vw-1.5rem)] flex-col bg-popover", className)}
    >
      <Picker.Search
        aria-label="Search emoji"
        placeholder="Search emoji"
        className="z-10 mx-2 mt-2 h-10 shrink-0 appearance-none rounded-full bg-surface-2 px-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Picker.Viewport data-lenis-prevent className="relative flex-1 outline-hidden">
        <Picker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">Loading…</Picker.Loading>
        <Picker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">No emoji found.</Picker.Empty>
        <Picker.List className="pb-1.5 select-none" components={LIST_COMPONENTS} />
      </Picker.Viewport>
    </Picker.Root>
  );
}

/** The picker in a popover. `children` is the trigger, or an anchor when `anchorOnly`. */
export function EmojiPopover({
  children,
  onPick,
  open,
  onOpenChange,
  anchorOnly = false,
  closeOnPick = false,
  ...content
}: {
  children: ReactNode;
  onPick: (emoji: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorOnly?: boolean;
  closeOnPick?: boolean;
} & Pick<ComponentProps<typeof Popover.Content>, "side" | "align" | "onOpenAutoFocus" | "onCloseAutoFocus">) {
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      {anchorOnly ? <Popover.Anchor asChild>{children}</Popover.Anchor> : <Popover.Trigger asChild>{children}</Popover.Trigger>}
      <Popover.Portal>
        <Popover.Content
          aria-label="Emoji picker"
          sideOffset={8}
          collisionPadding={12}
          side={content.side ?? "top"}
          align={content.align ?? "start"}
          onOpenAutoFocus={content.onOpenAutoFocus}
          onCloseAutoFocus={content.onCloseAutoFocus}
          className="z-[60] overflow-hidden rounded-[var(--radius-tile)] border border-border bg-popover shadow-[0_20px_60px_-20px_var(--shadow-strong)] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <EmojiPickerPanel
            onPick={(emoji) => {
              onPick(emoji);
              if (closeOnPick) onOpenChange?.(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
