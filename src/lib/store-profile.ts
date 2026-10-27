import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";

// The store's own details for the invoice header and the About page: one row, empty until the owner fills it in.

export type StoreProfileValues = { email: string | null; phone: string | null; address: string | null; abn: string | null };

export async function getStoreProfile(): Promise<StoreProfileValues> {
  const row = await prisma.storeProfile.findUnique({ where: { id: "store" }, select: { email: true, phone: true, address: true, abn: true } });
  return row ?? { email: null, phone: null, address: null, abn: null };
}

/** The ABN and address for the About page, cached until the owner saves new business details (refreshStoreProfile). */
export async function getPublicBusinessDetails(): Promise<Pick<StoreProfileValues, "address" | "abn">> {
  "use cache";
  cacheTag("store-profile");
  cacheLife("hours");
  const { address, abn } = await getStoreProfile();
  return { address, abn };
}

/** Values are stored as given; callers validate (see src/lib/admin/schemas/business.ts). */
export async function saveStoreProfile(values: StoreProfileValues): Promise<void> {
  await prisma.storeProfile.upsert({ where: { id: "store" }, create: { id: "store", ...values }, update: values });
}
