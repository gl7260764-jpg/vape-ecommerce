"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowBendUpLeftIcon, CheckIcon, PaperclipIcon, PaperPlaneRightIcon, PencilSimpleIcon, SmileyIcon, XIcon } from "@phosphor-icons/react";
import { EmojiPopover } from "@/components/chat/emoji-picker";
import type { ChatController, ChatMessage } from "@/components/chat/use-chat";
import { MAX_BODY } from "@/lib/chat/rules";
import { cn } from "@/lib/utils";

type Props = {
  chat: ChatController;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancel: () => void;
  nameFor: (sender: ChatMessage["sender"]) => string;
  placeholder?: string;
  disabled?: boolean;
  /** Changing this number moves the cursor into the message box. */
  focusKey?: number;
};

const preview = (m: ChatMessage) => m.body || (m.attachment?.kind === "image" ? "Photo" : (m.attachment?.name ?? ""));

/** On phones Enter adds a line and the send button sends, as in WhatsApp; with a keyboard, Enter sends. */
const touchKeyboard = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

export function Composer({ chat, replyTo, editing, onCancel, nameFor, placeholder = "Message", disabled = false, focusKey = 0 }: Props) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  const [draft, setDraft] = useState("");

  // Starting an edit puts that message in the box; finishing it brings the draft back.
  if ((editing?.id ?? null) !== editingId) {
    setEditingId(editing?.id ?? null);
    if (editing) {
      if (!editingId) setDraft(text);
      setText(editing.body);
    } else setText(draft);
  }

  useEffect(() => {
    if (!replyTo && !editing) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [replyTo, editing]);

  useEffect(() => {
    if (focusKey) area.current?.focus();
  }, [focusKey]);

  // Grow with the text, up to about six lines.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const { notice, dismissNotice } = chat;
  const message = problem ?? notice;
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      setProblem(null);
      dismissNotice();
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [message, dismissNotice]);

  const remember = () => {
    const el = area.current;
    if (el) caret.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const submit = () => {
    const body = text.trim();
    if (!body || disabled) return;
    if (body.length > MAX_BODY) {
      setProblem(`Messages can be up to ${MAX_BODY.toLocaleString("en-AU")} characters.`);
      return;
    }
    if (editing) {
      if (body !== editing.body) chat.edit(editing.id, body);
      setDraft("");
      onCancel();
      return;
    }
    chat.send({ body, replyToId: replyTo?.id ?? null });
    setText("");
    caret.current = { start: 0, end: 0 };
    if (replyTo) onCancel();
  };

  const addFiles = (list: FileList | File[]) => {
    for (const file of Array.from(list)) {
      const why = chat.sendFile(file, replyTo?.id ?? null);
      if (why) setProblem(why);
    }
    if (replyTo) onCancel();
  };

  const insertEmoji = (emoji: string) => {
    const { start, end } = caret.current;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    const at = start + emoji.length;
    caret.current = { start: at, end: at };
    requestAnimationFrame(() => area.current?.setSelectionRange(at, at));
  };

  const banner = editing ?? replyTo;
  const over = text.length > MAX_BODY - 300;

  return (
    <div className="border-t border-border bg-surface px-2.5 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      {message && (
        <p role="alert" className="mx-1 mb-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message}
        </p>
      )}

      {banner && (
        <div className="mx-1 mb-2 flex items-start gap-2.5 rounded-xl border-l-[3px] border-primary-ink bg-surface-2 py-2 pr-1.5 pl-3">
          {editing ? (
            <PencilSimpleIcon className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
          ) : (
            <ArrowBendUpLeftIcon className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-primary-ink">{editing ? "Editing message" : `Replying to ${nameFor(banner.sender)}`}</p>
            <p className="truncate text-[13px] text-muted-foreground">{preview(banner)}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={editing ? "Cancel editing" : "Cancel reply"}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            <XIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <div className="flex min-w-0 flex-1 items-end rounded-[1.4rem] border border-border bg-background pl-1">
          <EmojiPopover
            open={emojiOpen}
            onOpenChange={setEmojiOpen}
            onPick={insertEmoji}
            // On phones, focusing the search box would raise the keyboard over the picker.
            onOpenAutoFocus={(e) => touchKeyboard() && e.preventDefault()}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              area.current?.focus();
            }}
          >
            <button
              type="button"
              aria-label="Emoji"
              disabled={disabled}
              className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <SmileyIcon className="size-[1.4rem]" aria-hidden />
            </button>
          </EmojiPopover>
          <textarea
            ref={area}
            rows={1}
            value={text}
            disabled={disabled}
            aria-label="Message"
            placeholder={placeholder}
            maxLength={MAX_BODY + 200}
            onChange={(e) => {
              setText(e.target.value);
              remember();
              if (e.target.value) chat.notifyTyping();
            }}
            onSelect={remember}
            onKeyUp={remember}
            onBlur={remember}
            onPaste={(e) => {
              const pasted = Array.from(e.clipboardData.files);
              if (!pasted.length) return;
              e.preventDefault();
              addFiles(pasted);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && banner) {
                e.preventDefault();
                onCancel();
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touchKeyboard()) {
                e.preventDefault();
                submit();
              }
            }}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-5 outline-none placeholder:text-muted-foreground"
          />
          {!editing && (
            <>
              <button
                type="button"
                aria-label="Attach a photo or PDF"
                disabled={disabled}
                onClick={() => files.current?.click()}
                className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                <PaperclipIcon className="size-[1.3rem]" aria-hidden />
              </button>
              <input
                ref={files}
                type="file"
                multiple
                accept="image/*,application/pdf"
                tabIndex={-1}
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files?.length) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          aria-label={editing ? "Save" : "Send"}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-[transform,opacity] active:scale-95 disabled:opacity-40"
          )}
        >
          {editing ? <CheckIcon weight="bold" className="size-5" aria-hidden /> : <PaperPlaneRightIcon weight="fill" className="size-5" aria-hidden />}
        </button>
      </div>
      {over && (
        <p className={cn("mt-1 px-2 text-right text-xs tabular-nums", text.length > MAX_BODY ? "text-destructive" : "text-muted-foreground")}>
          {text.length.toLocaleString("en-AU")} / {MAX_BODY.toLocaleString("en-AU")}
        </p>
      )}
    </div>
  );
}
