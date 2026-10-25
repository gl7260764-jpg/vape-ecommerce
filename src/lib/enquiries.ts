import "server-only";
import { alertNewEnquiry } from "@/lib/alerts";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { CONTACT_EMAIL, SITE_URL } from "@/lib/site";

// The contact page's form: saved for Admin › Enquiries, then a phone alert and an email to the store.

export type EnquiryInput = { name: string; email: string; phone: string | null; message: string };

/** Callers validate (see src/app/actions/contact.ts). */
export async function createEnquiry(input: EnquiryInput): Promise<{ id: string }> {
  const phone = input.phone?.trim() || null;
  return prisma.enquiry.create({
    data: { name: input.name.trim(), email: input.email.trim().toLowerCase(), phone, message: input.message.trim() },
    select: { id: true },
  });
}

/** After the customer's response: a phone alert, and an email the team can answer with Reply. Never throws. */
export async function notifyEnquiry(id: string): Promise<void> {
  const e = await prisma.enquiry.findUnique({ where: { id } }).catch(() => null);
  if (!e) return;
  await alertNewEnquiry(e.name, e.message);
  const emailed = await sendEmail({
    sender: { name: "Website enquiry", email: CONTACT_EMAIL },
    to: [{ email: CONTACT_EMAIL }],
    replyTo: { email: e.email, name: e.name },
    subject: `New enquiry from ${e.name}`,
    textContent: [
      `${e.name} sent a message from the contact page.`,
      "",
      `Email: ${e.email}`,
      `Phone: ${e.phone ?? "not given"}`,
      "",
      e.message,
      "",
      "Reply to this email to answer them, or open the enquiry:",
      `${SITE_URL}/admin/enquiries`,
    ].join("\n"),
  });
  if (emailed) await prisma.enquiry.update({ where: { id }, data: { emailedAt: new Date() } }).catch(() => {});
}

/** Admin › Enquiries: done, or back to new. */
export async function markEnquiry(id: string, done: boolean): Promise<void> {
  await prisma.enquiry.update({ where: { id }, data: { handledAt: done ? new Date() : null } });
}
