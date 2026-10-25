import "server-only";

// Emails through Brevo's transactional API. The sender (the store's contact address) must be a verified
// sender in Brevo. Without BREVO_API_KEY nothing is sent.

/** Posts one email to Brevo; rejects if Brevo refuses it or doesn't answer. */
type Transport = (url: string, body: string, apiKey: string) => Promise<void>;

const BREVO_URL = process.env.BREVO_API_URL ?? "https://api.brevo.com/v3/smtp/email";

export const brevoTransport: Transport = async (url, body, apiKey) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Brevo answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

let transport = brevoTransport;

/** Tests replace the network call. */
export function setEmailTransport(fn: Transport) {
  transport = fn;
}

type Address = { email: string; name?: string };
export type Email = { sender: Address; to: Address[]; replyTo?: Address; subject: string; textContent: string };

/** Sends one email. Says whether Brevo took it; never throws. */
export async function sendEmail(email: Email): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY; // read each time, so a key added later works without a restart in tests
  if (!apiKey) return false;
  try {
    await transport(BREVO_URL, JSON.stringify(email), apiKey);
    return true;
  } catch (error) {
    console.error("email failed", error);
    return false;
  }
}
