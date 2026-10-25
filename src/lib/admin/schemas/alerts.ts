// The ntfy topic for the team's phone alerts. Empty turns them off.
import { z } from "zod";

/** What ntfy accepts as a topic name, and long enough that nobody can guess it. */
const TOPIC = /^[A-Za-z0-9_-]{12,64}$/;

export const alertSettingsSchema = z.object({
  topic: z
    .string()
    .trim()
    .refine((v) => v === "" || TOPIC.test(v), "Use at least 12 letters, numbers, - or _ so nobody can guess it. Make a topic picks one for you.")
    .transform((v) => v || null),
});

export type AlertSettingsInput = z.input<typeof alertSettingsSchema>;
