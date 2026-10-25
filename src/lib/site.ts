// The store's public address. SITE_URL overrides it on the server (a preview deployment, say).
export const SITE_URL = process.env.SITE_URL ?? "https://vapesupplieraustralia.com";
/** The address without "https://", as printed on invoices and shown in the admin. */
export const SITE_HOST = new URL(SITE_URL).host;

export const CONTACT_EMAIL = "contact@vapesupplieraustralia.com";
/** E.164 for tel: links; CONTACT_PHONE_DISPLAY is how it's written on the page. */
export const CONTACT_PHONE = "+61468187334";
export const CONTACT_PHONE_DISPLAY = "+61 468 187 334";
