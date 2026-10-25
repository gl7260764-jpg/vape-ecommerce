import "server-only";
import { formatAuPhone } from "@/lib/checkout";
import { prisma } from "@/lib/db";

export type SavedCheckoutDetails =
  | { fromOrder: true; fullName: string; email: string; phone: string; addressLine1: string; addressLine2: string; suburb: string; state: string; postcode: string }
  | { fromOrder: false; email: string };

/**
 * What the checkout fills in for a returning customer: the details of the last order placed on this
 * device. A device that only typed an email (signed in, or found orders by email) gets just that
 * email, never someone's address or phone.
 */
export async function savedCheckoutDetails(tokenHash: string | null): Promise<SavedCheckoutDetails | null> {
  if (!tokenHash) return null;
  const own = await prisma.orderAccess.findFirst({
    where: { tokenHash, fullDetails: true },
    orderBy: { order: { createdAt: "desc" } },
    select: { order: { select: { fullName: true, email: true, phone: true, addressLine1: true, addressLine2: true, suburb: true, state: true, postcode: true } } },
  });
  if (own) {
    const o = own.order;
    return {
      fromOrder: true,
      fullName: o.fullName,
      email: o.email,
      phone: formatAuPhone(o.phone),
      addressLine1: o.addressLine1,
      addressLine2: o.addressLine2 ?? "",
      suburb: o.suburb,
      state: o.state,
      postcode: o.postcode,
    };
  }
  const account = await prisma.chatConversation.findUnique({ where: { deviceTokenHash: tokenHash }, select: { customerEmail: true } });
  return account ? { fromOrder: false, email: account.customerEmail } : null;
}
