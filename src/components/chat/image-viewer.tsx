"use client";

import { DownloadSimpleIcon, XIcon } from "@phosphor-icons/react";
import { Dialog } from "radix-ui";

export type ViewerImage = { url: string; name: string };

/** A photo from the chat, full screen. */
export function ImageViewer({ image, onClose }: { image: ViewerImage | null; onClose: () => void }) {
  return (
    <Dialog.Root open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/92 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex flex-col outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <Dialog.Title className="sr-only">Photo</Dialog.Title>
          {image && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 text-white">
                <p className="min-w-0 flex-1 truncate text-sm text-white/80">{image.name}</p>
                <a
                  href={image.url}
                  download={image.name}
                  aria-label="Download photo"
                  className="grid size-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <DownloadSimpleIcon className="size-5" aria-hidden />
                </a>
                <Dialog.Close
                  aria-label="Close photo"
                  className="grid size-10 place-items-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <XIcon className="size-5" aria-hidden />
                </Dialog.Close>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0" onClick={onClose}>
                {/* eslint-disable-next-line @next/next/no-img-element -- private, access-checked file; the image optimiser can't fetch it */}
                <img src={image.url} alt={image.name} className="max-h-full max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
