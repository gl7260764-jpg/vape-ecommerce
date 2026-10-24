// Pusher channel and event names, shared by the server that publishes and the browsers that listen.

export const channels = {
  /** One conversation: its customer device and the admins. */
  conversation: (id: string) => `private-conversation-${id}`,
  /** Admins only: inbox changes and the unread total. */
  inbox: "private-admin-inbox",
  /** Public: whether the team is online. */
  store: "store-status",
} as const;

export const EVENTS = {
  message: "message",
  reaction: "reaction",
  receipts: "receipts",
  typing: "client-typing",
  inbox: "inbox",
  badge: "badge",
  presence: "presence",
} as const;

/** Conversation ids are cuids; anything else in a channel name is refused. */
export const CONVERSATION_CHANNEL = /^private-conversation-([a-z0-9]{20,40})$/;
