// Shapes the chat sends to browsers. Client-safe (types only).
import type { InvoiceSnapshot, InvoiceStatus } from "@/lib/invoices/types";

export type ChatSide = "customer" | "staff";

/** A file already saved in the bucket, ready to attach to a message. */
export type StoredAttachment = { key: string; name: string; mime: string; size: number; width: number | null; height: number | null };

export type ChatOrderSummary = {
  id: string;
  number: number;
  totalCents: number;
  paymentMethod: "bank_transfer" | "payid";
  status: string;
  /** The device's own order page, for customers. Null for the admin. */
  link: string | null;
};

/** An invoice in the chat: on the invoice message itself and on its "is everything correct?" question. */
export type ChatInvoiceDTO = {
  id: string;
  number: string;
  version: number;
  snapshot: InvoiceSnapshot;
  status: InvoiceStatus;
  askConfirm: boolean;
  answer: "confirmed" | "disputed" | null;
  /** The order's newest invoice. Older ones are replaced and can't be answered. */
  latest: boolean;
  /** The full invoice page: the customer's private link, or the admin's. */
  link: string;
};

export type ChatMessageDTO = {
  id: string;
  sender: "customer" | "staff" | "system";
  /** Sent by the person viewing: the customer, or this team member. */
  mine: boolean;
  /** Which team member wrote it. Only ever filled in for admin viewers. */
  staffName: string | null;
  body: string;
  attachment: { url: string; name: string; mime: string; size: number; width: number | null; height: number | null; kind: "image" | "file" } | null;
  replyTo: { id: string; sender: string; preview: string } | null;
  order: ChatOrderSummary | null;
  invoice: ChatInvoiceDTO | null;
  edited: boolean;
  deleted: boolean;
  /** True only for whoever deleted it, so they see "You deleted this message". */
  deletedBySelf: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactions: { by: ChatSide; emoji: string }[];
};

export type ConversationDTO = {
  id: string;
  customerName: string;
  customerEmail: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  staffUnreadCount: number;
  customerUnreadCount: number;
  customerLastSeenAt: string | null;
  /** Set while this device hasn't placed an order: its email was typed, not proven by an order. */
  tag: "Subscriber" | "New account" | null;
};

/** What a sync returns: the messages that changed, and the server time to ask from next. */
export type ChatSync = { now: string; messages: ChatMessageDTO[] };
