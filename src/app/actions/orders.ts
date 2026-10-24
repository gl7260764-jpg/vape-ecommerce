"use server";

import { forgetThisDevice } from "@/lib/customer-orders";

/** "Sign out on this device", for shared or borrowed computers: forgets its orders and its chat. */
export async function forgetOrders(): Promise<{ ok: boolean }> {
  try {
    await forgetThisDevice();
    return { ok: true };
  } catch (error) {
    console.error("forget orders failed", error);
    return { ok: false };
  }
}
