"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from "react";
import type { Channel } from "pusher-js";
import { getPusher, listen } from "@/components/chat/pusher-client";
import type { ActionResult } from "@/lib/admin/result";
import { channels, EVENTS } from "@/lib/chat/channels";
import { attachmentKind, MAX_UPLOAD_BYTES } from "@/lib/chat/rules";
import type { ChatMessageDTO, ChatSide, StoredAttachment } from "@/lib/chat/types";

// One conversation's state for either side. The server copy of each message is kept by id, so a
// message that arrives twice (the send's own reply, a poll, a second tab) still shows once.
// Optimistic sends live beside it until the server copy lands; in-flight edits, deletes and
// reactions are patches laid over the server copy until the server answers.

export type ChatMessage = ChatMessageDTO & { status?: "sending" | "failed"; error?: string };

export type ChatActions = {
  send: (input: { id: string; body: string; replyToId?: string | null; attachment?: StoredAttachment | null }) => Promise<ActionResult<ChatMessageDTO>>;
  edit: (input: { id: string; body: string }) => Promise<ActionResult<ChatMessageDTO>>;
  delete: (input: { id: string }) => Promise<ActionResult<ChatMessageDTO>>;
  react: (input: { id: string; emoji: string | null }) => Promise<ActionResult<null>>;
  receipts: (input: { kind: "delivered" | "read"; upTo: string }) => Promise<ActionResult<null>>;
  /** Customers only: their answer to the invoice question. */
  answerInvoice?: (input: { invoiceId: string; answer: "confirmed" | "disputed" }) => Promise<ActionResult<ChatMessageDTO[]>>;
};

export type ChatConfig = {
  side: ChatSide;
  conversationId: string;
  /** GET: the newest 200; `?changedSince=` what changed since that server time; `?before=` 50 older. */
  snapshotUrl: string;
  /** POST multipart `file`: returns `{ ok, data: StoredAttachment }`. */
  uploadUrl: string;
  actions: ChatActions;
  /** Listen on Pusher for changes (falls back to polling whenever the connection drops); false polls only. */
  live: boolean;
  /** Called after each message is saved (the customer's 10-minute live window starts here). */
  onSent?: () => void;
};

const POLL_MS = 4000;
/** While live, a slow safety sync still refreshes presence and anything a dropped event missed. */
const LIVE_SYNC_MS = 30_000;
/** Not connected for this long: switch to polling. */
const DOWN_MS = 5000;
const TYPING_SEND_MS = 3000;
const TYPING_SHOW_MS = 5000;
const FIRST_PAGE = 200;
const OLDER_PAGE = 50;

type Outgoing = { body: string; replyToId: string | null; attachment: StoredAttachment | null; file: File | null; previewUrl: string | null };

type State = {
  server: Map<string, ChatMessageDTO>;
  local: Map<string, ChatMessage>;
  patches: Map<string, Partial<ChatMessageDTO>>;
};

type Event =
  | { type: "merge"; messages: ChatMessageDTO[] }
  | { type: "local"; message: ChatMessage }
  | { type: "local-status"; id: string; status: "sending" | "failed"; error?: string }
  | { type: "local-remove"; id: string }
  | { type: "patch"; id: string; patch: Partial<ChatMessageDTO> | null };

function reducer(state: State, event: Event): State {
  switch (event.type) {
    case "merge": {
      let server: Map<string, ChatMessageDTO> | null = null;
      let local: Map<string, ChatMessage> | null = null;
      for (const m of event.messages) {
        const current = (server ?? state.server).get(m.id);
        // Server times only: an older copy (a poll that started before an edit) never replaces a newer one.
        if (!current || current.updatedAt <= m.updatedAt) {
          server ??= new Map(state.server);
          server.set(m.id, m);
        }
        if ((local ?? state.local).has(m.id)) {
          local ??= new Map(state.local);
          local.delete(m.id);
        }
      }
      return server || local ? { ...state, server: server ?? state.server, local: local ?? state.local } : state;
    }
    case "local": {
      const local = new Map(state.local);
      local.set(event.message.id, event.message);
      return { ...state, local };
    }
    case "local-status": {
      const current = state.local.get(event.id);
      if (!current) return state;
      const local = new Map(state.local);
      local.set(event.id, { ...current, status: event.status, error: event.error });
      return { ...state, local };
    }
    case "local-remove": {
      if (!state.local.has(event.id)) return state;
      const local = new Map(state.local);
      local.delete(event.id);
      return { ...state, local };
    }
    case "patch": {
      const patches = new Map(state.patches);
      if (event.patch) patches.set(event.id, { ...patches.get(event.id), ...event.patch });
      else patches.delete(event.id);
      return { ...state, patches };
    }
  }
}

const byTime = (a: ChatMessage, b: ChatMessage) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1);

/** A v4 uuid, also on plain-http dev URLs where crypto.randomUUID is missing. */
function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Photos are shrunk to at most 2000 px before upload (the server re-encodes them again). */
async function shrinkPhoto(file: File): Promise<File> {
  if (file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_UPLOAD_BYTES) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    let blob = await encode("image/webp");
    if (!blob || blob.type !== "image/webp") {
      // No WebP encoder (older Safari): JPEG on white, since JPEG has no transparency.
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      blob = await encode("image/jpeg");
    }
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
  } catch {
    return file;
  }
}

class UploadFailed extends Error {}

async function upload(url: string, file: File): Promise<StoredAttachment> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  const data = (await res.json().catch(() => null)) as { ok?: boolean; data?: StoredAttachment; error?: string } | null;
  if (!res.ok || !data?.ok || !data.data) throw new UploadFailed(data?.error ?? "That file couldn't be sent. Try again.");
  return data.data;
}

const visibility = {
  subscribe: (fn: () => void) => {
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  },
  get: () => document.visibilityState === "visible",
  server: () => false,
};

/** Whether this tab is in front. Read receipts only go out while it is. */
export function useTabVisible() {
  return useSyncExternalStore(visibility.subscribe, visibility.get, visibility.server);
}

export function useChat<Extra extends object = object>(config: ChatConfig) {
  const { side, conversationId, snapshotUrl, uploadUrl, live } = config;
  const [state, dispatch] = useReducer(reducer, { server: new Map(), local: new Map(), patches: new Map() });
  const [info, setInfo] = useState<Extra | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [hasMore, setHasMore] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const visible = useTabVisible();

  const actionsRef = useRef(config.actions);
  const onSentRef = useRef(config.onSent);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    actionsRef.current = config.actions;
    onSentRef.current = config.onSent;
    stateRef.current = state;
  });

  const outbox = useRef(new Map<string, Outgoing>());
  const cursor = useRef<string | null>(null);
  const running = useRef<Promise<void> | null>(null);
  const queued = useRef<Promise<void> | null>(null);
  const sentReceipt = useRef({ delivered: "", read: "" });
  const loadingOlder = useRef(false);

  const say = useCallback((text: string) => setNotice(text), []);

  const fetchOnce = useCallback(async () => {
    const sep = snapshotUrl.includes("?") ? "&" : "?";
    const url = cursor.current ? `${snapshotUrl}${sep}changedSince=${encodeURIComponent(cursor.current)}` : snapshotUrl;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404 || res.status === 403) {
        setStatus("unavailable");
        return;
      }
      if (!res.ok) return;
      const { messages, ...rest } = (await res.json()) as { now: string; messages: ChatMessageDTO[] } & Extra;
      const first = cursor.current === null;
      cursor.current = rest.now;
      dispatch({ type: "merge", messages });
      setInfo(rest as unknown as Extra);
      if (first) {
        setHasMore(messages.length >= FIRST_PAGE);
        setStatus("ready");
      }
    } catch {
      // Offline or the server is waking up: the next poll tries again.
    }
  }, [snapshotUrl]);

  /** Fetch what changed. Calls made while one is running share a single follow-up fetch. */
  const sync = useCallback((): Promise<void> => {
    const run = () => {
      const current = fetchOnce().finally(() => {
        running.current = null;
      });
      running.current = current;
      return current;
    };
    if (!running.current) return run();
    queued.current ??= running.current.then(() => {
      queued.current = null;
      return run();
    });
    return queued.current;
  }, [fetchOnce]);

  const [connection, setConnection] = useState<"live" | "polling">("polling");
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<Channel | null>(null);
  const lastTypingSent = useRef(0);

  // First load, then poll (every 4 s, or a slow safety sync while live). Also catch up as soon as
  // the tab returns or the network comes back.
  useEffect(() => {
    void sync();
    const tick = () => {
      if (!running.current) void sync();
    };
    const timer = window.setInterval(tick, connection === "live" ? LIVE_SYNC_MS : POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", tick);
    };
  }, [sync, connection]);

  // Live: Pusher events only say "something changed", then the access-checked sync fetches it.
  // Not connected for 5 s: back to polling. Connected again: catch up once, then live.
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    let stop: (() => void) | null = null;
    let unbindState: (() => void) | null = null;
    let down: number | null = null;
    let typingTimer: number | null = null;

    const goLive = () => {
      if (down !== null) window.clearTimeout(down);
      down = null;
      void sync().then(() => !cancelled && setConnection("live"));
    };
    const goingDown = () => {
      down ??= window.setTimeout(() => !cancelled && setConnection("polling"), DOWN_MS);
    };

    void getPusher(side).then((pusher) => {
      if (cancelled || !pusher) return;
      const name = channels.conversation(conversationId);
      const changed = () => void sync();
      const listener = listen(pusher, name, {
        [EVENTS.message]: () => {
          setPeerTyping(false);
          changed();
        },
        [EVENTS.reaction]: changed,
        [EVENTS.receipts]: changed,
        [EVENTS.typing]: (data) => {
          if ((data as { side?: string } | null)?.side === side) return;
          setPeerTyping(true);
          if (typingTimer !== null) window.clearTimeout(typingTimer);
          typingTimer = window.setTimeout(() => setPeerTyping(false), TYPING_SHOW_MS);
        },
        "pusher:subscription_succeeded": () => pusher.connection.state === "connected" && goLive(),
        "pusher:subscription_error": goingDown,
      });
      stop = listener.stop;
      channelRef.current = listener.channel;
      const onState = ({ current }: { current: string }) => {
        if (current === "connected") {
          if (listener.channel.subscribed) goLive();
        } else goingDown();
      };
      pusher.connection.bind("state_change", onState);
      // The browser knows it's offline long before Pusher's 30 s ping gives up; and back online, a
      // socket that survived the gap still needs a catch-up.
      const onOffline = () => goingDown();
      const onOnline = () => pusher.connection.state === "connected" && listener.channel.subscribed && goLive();
      window.addEventListener("offline", onOffline);
      window.addEventListener("online", onOnline);
      unbindState = () => {
        pusher.connection.unbind("state_change", onState);
        window.removeEventListener("offline", onOffline);
        window.removeEventListener("online", onOnline);
      };
      if (pusher.connection.state === "connected" && listener.channel.subscribed) goLive();
      else if (pusher.connection.state !== "connected") goingDown();
    });

    return () => {
      cancelled = true;
      stop?.();
      unbindState?.();
      if (down !== null) window.clearTimeout(down);
      if (typingTimer !== null) window.clearTimeout(typingTimer);
      channelRef.current = null;
      setConnection("polling");
      setPeerTyping(false);
    };
  }, [live, side, conversationId, sync]);

  const messages = useMemo(() => {
    const list: ChatMessage[] = [];
    for (const m of state.server.values()) {
      const patch = state.patches.get(m.id);
      list.push(patch ? { ...m, ...patch } : m);
    }
    for (const m of state.local.values()) list.push(m);
    return list.sort(byTime);
  }, [state]);

  // Ticks for the other side's messages: delivered as soon as they reach this screen, read while the tab is in front.
  // The server's unread counter also counts things that aren't messages from the other side (a new
  // order for the team), so a counter above zero is read too.
  const unreadCounter =
    (info as { conversation?: { staffUnreadCount?: number; customerUnreadCount?: number } } | null)?.conversation?.[
      side === "staff" ? "staffUnreadCount" : "customerUnreadCount"
    ] ?? 0;
  useEffect(() => {
    let undelivered = "";
    let unread = "";
    let newest = "";
    for (const m of messages) {
      if (m.status) continue;
      if (m.createdAt > newest) newest = m.createdAt;
      const fromOtherSide = side === "customer" ? m.sender !== "customer" : m.sender === "customer";
      if (!fromOtherSide) continue;
      if (!m.deliveredAt && m.createdAt > undelivered) undelivered = m.createdAt;
      if (!m.readAt && m.createdAt > unread) unread = m.createdAt;
    }
    if (!unread && unreadCounter > 0) unread = newest;
    const kind = visible && unread ? "read" : undelivered ? "delivered" : null;
    const upTo = kind === "read" ? unread : undelivered;
    if (!kind || upTo <= sentReceipt.current[kind]) return;
    const before = sentReceipt.current[kind];
    sentReceipt.current[kind] = upTo;
    if (kind === "read" && upTo > sentReceipt.current.delivered) sentReceipt.current.delivered = upTo;
    actionsRef.current
      .receipts({ kind, upTo })
      .then((r) => {
        if (!r.ok) sentReceipt.current[kind] = before;
        else void sync();
      })
      .catch(() => {
        sentReceipt.current[kind] = before;
      });
  }, [messages, visible, side, sync, unreadCounter]);

  const deliver = useCallback(
    async (id: string) => {
      const job = outbox.current.get(id);
      if (!job) return;
      dispatch({ type: "local-status", id, status: "sending" });
      try {
        if (job.file) {
          const file = job.file.type.startsWith("image/") ? await shrinkPhoto(job.file) : job.file;
          if (file.size > MAX_UPLOAD_BYTES) throw new UploadFailed(`${job.file.name} is over 4 MB. Send a smaller file.`);
          job.attachment = await upload(uploadUrl, file);
          job.file = null; // a retry sends the uploaded file instead of uploading it again
        }
        const result = await actionsRef.current.send({ id, body: job.body, replyToId: job.replyToId, attachment: job.attachment });
        if (!result.ok) {
          dispatch({ type: "local-status", id, status: "failed", error: result.error });
          return;
        }
        outbox.current.delete(id);
        dispatch({ type: "merge", messages: [result.data] });
        const preview = job.previewUrl;
        if (preview) window.setTimeout(() => URL.revokeObjectURL(preview), 30_000);
        onSentRef.current?.();
      } catch (error) {
        const message = error instanceof UploadFailed ? error.message : "No connection.";
        dispatch({ type: "local-status", id, status: "failed", error: message });
      }
    },
    [uploadUrl]
  );

  const replyFor = useCallback(
    (replyToId: string | null | undefined): ChatMessageDTO["replyTo"] => {
      if (!replyToId) return null;
      const target = stateRef.current.server.get(replyToId);
      if (!target) return null;
      const preview = target.deleted ? "This message was deleted" : target.body || (target.attachment?.kind === "image" ? "Photo" : (target.attachment?.name ?? ""));
      return { id: target.id, sender: target.sender, preview: preview.slice(0, 80) };
    },
    []
  );

  const queue = useCallback(
    (job: Outgoing, attachment: ChatMessageDTO["attachment"]) => {
      const id = newId();
      outbox.current.set(id, job);
      const now = new Date().toISOString();
      dispatch({
        type: "local",
        message: {
          id,
          sender: side,
          mine: true,
          staffName: null,
          body: job.body,
          attachment,
          replyTo: replyFor(job.replyToId),
          order: null,
          invoice: null,
          edited: false,
          deleted: false,
          deletedBySelf: false,
          deliveredAt: null,
          readAt: null,
          createdAt: now,
          updatedAt: now,
          reactions: [],
          status: "sending",
        },
      });
      void deliver(id);
    },
    [deliver, replyFor, side]
  );

  const send = useCallback(
    (input: { body: string; replyToId?: string | null; attachment?: StoredAttachment | null }) => {
      const body = input.body.trim();
      if (!body && !input.attachment) return;
      queue({ body, replyToId: input.replyToId ?? null, attachment: input.attachment ?? null, file: null, previewUrl: null }, null);
    },
    [queue]
  );

  /** Checks the file and sends it as its own message. Returns why it can't be sent, or null. */
  const sendFile = useCallback(
    (file: File, replyToId?: string | null): string | null => {
      const kind = attachmentKind(file.type);
      if (!kind) return "Only photos and PDFs can be sent.";
      if (kind === "file" && file.size > MAX_UPLOAD_BYTES) return `${file.name} is over 4 MB. Send a smaller file.`;
      const previewUrl = kind === "image" ? URL.createObjectURL(file) : null;
      queue(
        { body: "", replyToId: replyToId ?? null, attachment: null, file, previewUrl },
        { url: previewUrl ?? "", name: file.name, mime: file.type, size: file.size, width: null, height: null, kind }
      );
      return null;
    },
    [queue]
  );

  const retry = useCallback((id: string) => void deliver(id), [deliver]);

  /** Drops a message that never sent. */
  const discard = useCallback((id: string) => {
    const job = outbox.current.get(id);
    if (job?.previewUrl) URL.revokeObjectURL(job.previewUrl);
    outbox.current.delete(id);
    dispatch({ type: "local-remove", id });
  }, []);

  const edit = useCallback(
    (id: string, text: string) => {
      const body = text.trim();
      if (!body) return;
      dispatch({ type: "patch", id, patch: { body, edited: true } });
      actionsRef.current
        .edit({ id, body })
        .then((r) => (r.ok ? dispatch({ type: "merge", messages: [r.data] }) : say(r.error)))
        .catch(() => say("No connection. Your change wasn't saved."))
        .finally(() => dispatch({ type: "patch", id, patch: null }));
    },
    [say]
  );

  const remove = useCallback(
    (id: string) => {
      if (outbox.current.has(id)) return discard(id);
      dispatch({ type: "patch", id, patch: { deleted: true, deletedBySelf: true, body: "", attachment: null, reactions: [] } });
      actionsRef.current
        .delete({ id })
        .then((r) => (r.ok ? dispatch({ type: "merge", messages: [r.data] }) : say(r.error)))
        .catch(() => say("No connection. The message wasn't deleted."))
        .finally(() => dispatch({ type: "patch", id, patch: null }));
    },
    [discard, say]
  );

  const react = useCallback(
    (id: string, emoji: string | null) => {
      const message: ChatMessageDTO | undefined = stateRef.current.server.get(id);
      if (!message) return;
      const reactions = message.reactions.filter((r) => r.by !== side);
      if (emoji) reactions.push({ by: side, emoji });
      dispatch({ type: "patch", id, patch: { reactions } });
      actionsRef.current
        .react({ id, emoji })
        .then(async (r) => (r.ok ? sync() : say(r.error)))
        .catch(() => say("No connection. Your reaction wasn't saved."))
        .finally(() => dispatch({ type: "patch", id, patch: null }));
    },
    [side, say, sync]
  );

  const loadOlder = useCallback(async () => {
    if (!hasMore || loadingOlder.current) return;
    let oldest: string | null = null;
    for (const m of stateRef.current.server.values()) if (!oldest || m.createdAt < oldest) oldest = m.createdAt;
    if (!oldest) return;
    loadingOlder.current = true;
    try {
      const sep = snapshotUrl.includes("?") ? "&" : "?";
      const res = await fetch(`${snapshotUrl}${sep}before=${encodeURIComponent(oldest)}`, { cache: "no-store" });
      if (!res.ok) return;
      const { messages: older } = (await res.json()) as { messages: ChatMessageDTO[] };
      dispatch({ type: "merge", messages: older });
      setHasMore(older.length >= OLDER_PAGE);
    } catch {
      // Try again on the next scroll to the top.
    } finally {
      loadingOlder.current = false;
    }
  }, [hasMore, snapshotUrl]);

  /** "typing…" on the other side, at most every 3 s. Only over Pusher; polling shows no typing. */
  const notifyTyping = useCallback(() => {
    const channel = channelRef.current;
    const now = Date.now();
    if (!channel?.subscribed || now - lastTypingSent.current < TYPING_SEND_MS) return;
    lastTypingSent.current = now;
    channel.trigger(EVENTS.typing, { side });
  }, [side]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  /** Sends the answer, then syncs so the invoice and its question show it. True when it went through. */
  const answerInvoice = useCallback(
    async (invoiceId: string, answer: "confirmed" | "disputed") => {
      const run = actionsRef.current.answerInvoice;
      if (!run) return false;
      try {
        const result = await run({ invoiceId, answer });
        if (!result.ok) {
          say(result.error);
          return false;
        }
        dispatch({ type: "merge", messages: result.data });
        await sync();
        return true;
      } catch {
        say("No connection. Your answer wasn't sent. Try again.");
        return false;
      }
    },
    [say, sync]
  );

  return {
    messages,
    info,
    status,
    hasMore,
    loadOlder,
    send,
    sendFile,
    retry,
    discard,
    edit,
    remove,
    react,
    answerInvoice,
    peerTyping,
    notifyTyping,
    connection,
    notice,
    dismissNotice,
    sync,
  };
}

export type ChatController = ReturnType<typeof useChat>;
