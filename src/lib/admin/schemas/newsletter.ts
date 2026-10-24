// Newsletter pop-up settings rules shared by the form and the server action.
import { z } from "zod";
import type { NewsletterSettingsValues } from "@/lib/newsletter";

const seconds = (min: number, max: number, tooLow: string, tooHigh: string) =>
  z.number({ error: "Enter a whole number of seconds" }).int("Enter a whole number of seconds").min(min, tooLow).max(max, tooHigh);

export const newsletterSettingsSchema = z
  .object({
    popupEnabled: z.boolean(),
    installOffersEnabled: z.boolean(),
    firstDelaySeconds: seconds(0, 600, "Can't be negative", "Keep it under 10 minutes (600 seconds)"),
    repeatEverySeconds: seconds(3, 86_400, "At least 3 seconds", "Keep it under a day (86400 seconds)"),
    // "forever" comes back until they subscribe; "times" stops after maxShows opens on their device.
    mode: z.enum(["forever", "times"]),
    maxShows: z.number({ error: "Between 1 and 100 times" }).optional(),
  })
  .refine((v) => v.mode === "forever" || (Number.isInteger(v.maxShows) && v.maxShows! >= 1 && v.maxShows! <= 100), {
    message: "Between 1 and 100 times",
    path: ["maxShows"],
  })
  .transform(({ mode, maxShows, ...rest }): NewsletterSettingsValues => ({ ...rest, maxShows: mode === "times" ? maxShows! : null }));

export type NewsletterSettingsInput = z.input<typeof newsletterSettingsSchema>;
