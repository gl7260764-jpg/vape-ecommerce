import { unstable_rethrow } from "next/navigation";
import { currentVisit } from "@/lib/analytics/record";
import { appOffersFor } from "@/lib/app-install";
import { currentDeviceTokenHash } from "@/lib/customer-orders";

/** For the install offers: is this device signed in, has its email used the welcome discount, is the app installed. */
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(await appOffersFor(await currentDeviceTokenHash(), (await currentVisit()).visitorId), { headers });
  } catch (error) {
    unstable_rethrow(error);
    console.error("app offers status failed", error);
    return Response.json({ welcomeUsed: false, signedIn: false, installed: false }, { headers });
  }
}
