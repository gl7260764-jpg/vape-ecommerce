import "server-only";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";

// Admin › Enquiries: the contact page's messages, new ones first, and the last ones marked done.

const select = { id: true, name: true, email: true, phone: true, message: true, createdAt: true, handledAt: true } as const;

export async function enquiryLists() {
  await requireAdmin();
  const [open, done] = await Promise.all([
    prisma.enquiry.findMany({ where: { handledAt: null }, orderBy: { createdAt: "desc" }, take: 100, select }),
    prisma.enquiry.findMany({ where: { handledAt: { not: null } }, orderBy: { handledAt: "desc" }, take: 30, select }),
  ]);
  return { open, done };
}

export type EnquiryRow = Awaited<ReturnType<typeof enquiryLists>>["open"][number];
