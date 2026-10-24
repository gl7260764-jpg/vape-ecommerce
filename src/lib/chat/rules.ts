// Chat rules shared by the server (the real check) and the UI (what to offer). Pure and client-safe.

export const MAX_BODY = 4000;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const ONLINE_MS = { customer: 45_000, staff: 60_000 } as const;
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
export const RATE_PER_MINUTE = { customer: 30, staff: 60 } as const;

/**
 * The only shape of key the upload step writes: chat/<conversationId>/<12 hex>-<slug>.<webp|pdf>.
 * Checked when a file is attached to a message and again whenever one is served or deleted.
 */
export const CHAT_FILE_KEY = /^chat\/([a-z0-9]{20,40})\/[a-f0-9]{12}-[a-z0-9-]{1,40}\.(webp|pdf)$/;

export type Actor = { kind: "customer"; conversationId: string } | { kind: "staff"; adminId: string; canModerate: boolean };

export type MessageFacts = {
  sender: "customer" | "staff" | "system";
  staffId: string | null;
  conversationId: string;
  createdAt: Date;
  deletedAt: Date | null;
  hasAttachment: boolean;
};

/** The individual who sent it: the customer of this conversation, or the team member who wrote it. */
function isOwn(m: MessageFacts, a: Actor) {
  if (a.kind === "customer") return m.sender === "customer" && m.conversationId === a.conversationId;
  return m.sender === "staff" && m.staffId !== null && m.staffId === a.adminId;
}

/** Your own text messages, at any time. Photos and PDFs can't be edited, only deleted. */
export function canEdit(m: MessageFacts, a: Actor): boolean {
  return !m.deletedAt && !m.hasAttachment && isOwn(m, a);
}

/** Your own messages at any time; the owner (moderator) can also remove anyone's, except system cards. */
export function canDelete(m: MessageFacts, a: Actor): boolean {
  if (m.deletedAt || m.sender === "system") return false;
  if (isOwn(m, a)) return true;
  return a.kind === "staff" && a.canModerate;
}

export function isOnline(lastSeenAt: Date | null, kind: "customer" | "staff", now: Date): boolean {
  return lastSeenAt !== null && now.getTime() - lastSeenAt.getTime() <= ONLINE_MS[kind];
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]);

/** Photos and PDFs only. Everything else (SVG, HTML, Word, spreadsheets) is refused. */
export function attachmentKind(mime: string): "image" | "file" | null {
  if (IMAGE_TYPES.has(mime)) return "image";
  if (mime === "application/pdf") return "file";
  return null;
}

/** One line for the inbox and notifications. */
export function previewText(m: { body: string; deletedAt: Date | null; attachmentKind: "image" | "file" | null; attachmentName: string | null }): string {
  if (m.deletedAt) return "This message was deleted";
  const text = m.body.replace(/\s+/g, " ").trim();
  if (!text && m.attachmentKind === "image") return "Photo";
  if (!text && m.attachmentKind === "file") return m.attachmentName ?? "PDF";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}
