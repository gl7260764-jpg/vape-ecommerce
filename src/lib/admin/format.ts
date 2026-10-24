// Admin date formatting. The store runs on Sydney time, whatever the server's zone.
const date = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" });
const dateTime = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Australia/Sydney" });

export const formatDate = (d: Date) => date.format(d);
export const formatDateTime = (d: Date) => dateTime.format(d);
