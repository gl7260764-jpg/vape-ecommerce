"use client";

import { useRef, type RefObject } from "react";
import { XIcon } from "@phosphor-icons/react";
import { Dialog as DialogPrimitive } from "radix-ui";

/**
 * The chat's window: on computers a floating window above the chat button (the page behind stays
 * usable, so a click outside doesn't close it); on phones the whole screen, holding the focus like any
 * full-screen dialog. Escape and ✕ close it, and the focus goes back to the chat button.
 */
export function ChatWindow({
  open,
  onOpenChange,
  modal,
  returnFocusTo,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal: boolean;
  returnFocusTo: RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          ref={contentRef}
          data-lenis-prevent
          onInteractOutside={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusTo.current?.focus();
          }}
          className="fixed inset-0 z-[var(--z-overlay)] flex flex-col overflow-hidden bg-background text-foreground outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-6 sm:inset-auto sm:right-6 sm:bottom-24 sm:h-[min(620px,calc(100dvh-8rem))] sm:w-[400px] sm:rounded-[22px] sm:border sm:border-border sm:shadow-[0_30px_80px_-25px_var(--shadow-strong)]"
        >
          <DialogPrimitive.Title className="sr-only">Chat with us</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Messages with the Best Vape Shop team.</DialogPrimitive.Description>
          {children}
          <DialogPrimitive.Close
            aria-label="Close chat"
            className="absolute top-3 right-3 grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <XIcon className="size-[18px]" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
