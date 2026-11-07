// A blog post's cover, 1200x630 (also its link preview): a short headline on the left, product photos on the
// right, in the store's colours. Product photos come from the store's own /media (cut-out shots look best).
//
// usage: node scripts/blog/cover.mjs <post-slug> "<kicker>" "<headline>" <photo> [<photo>] [--vs]
//   <photo>: a /media key ("products/1614-0-635662fc1d73.webp"), an https URL or a local file
//   --vs:    two photos with a VS badge between them, for comparisons
// writes public/blog/<post-slug>.jpg. Needs the internet for the Archivo font and the photos.
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const vs = args.includes("--vs");
const [slug, kicker, headline, ...photos] = args.filter((a) => a !== "--vs");
if (!slug || !kicker || !headline || !photos.length) throw new Error('usage: node scripts/blog/cover.mjs <slug> "<kicker>" "<headline>" <photo> [<photo>] [--vs]');

const SITE = "https://vapesupplieraustralia.com";
async function dataUrl(photo) {
  // Trimmed, so a photo's empty border doesn't shrink the product.
  const png = async (buffer) => `data:image/png;base64,${(await sharp(buffer).trim().png().toBuffer()).toString("base64")}`;
  if (!/^https?:|^products\//.test(photo)) return png(readFileSync(photo));
  const url = photo.startsWith("products/") ? `${SITE}/media/${photo}?w=1080` : photo;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return png(Buffer.from(await res.arrayBuffer()));
}
const images = await Promise.all(photos.map(dataUrl));

const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&display=block" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative; background: #0f1014; color: #f4f5f7; font-family: Archivo, sans-serif; }
  .glow { position: absolute; width: 760px; height: 760px; right: -140px; top: -80px; border-radius: 50%; background: radial-gradient(circle, rgba(201,240,96,.30), rgba(201,240,96,0) 65%); }
  .text { position: absolute; left: 72px; top: 64px; bottom: 64px; width: 560px; display: flex; flex-direction: column; }
  .logo { display: flex; align-items: center; gap: 14px; font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: #b9bcc4; }
  .b { width: 44px; height: 44px; border-radius: 50%; background: #c9f060; color: #0c1108; display: grid; place-items: center; font-weight: 900; font-size: 20px; letter-spacing: 0; }
  .kicker { margin-top: auto; font-size: 22px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: #c9f060; }
  h1 { margin: 14px 0 0; font-size: 76px; line-height: .92; font-weight: 900; font-stretch: 112%; text-transform: uppercase; letter-spacing: -.03em; }
  .photos { position: absolute; right: 48px; top: 40px; bottom: 40px; width: 520px; display: flex; align-items: center; justify-content: center; gap: 8px; }
  .photos img { max-height: ${vs ? 380 : 520}px; max-width: ${vs ? 220 : 480}px; object-fit: contain; filter: drop-shadow(0 30px 40px rgba(0,0,0,.55)); }
  .vs { width: 64px; height: 64px; flex: none; border-radius: 50%; background: #c9f060; color: #0c1108; display: grid; place-items: center; font-weight: 900; font-size: 24px; }
</style></head><body>
  <div class="glow"></div>
  <div class="text">
    <div class="logo"><div class="b">B</div>Best Vape Shop Australia</div>
    <div class="kicker">${kicker}</div>
    <h1>${headline}</h1>
  </div>
  <div class="photos">${images.map((src, i) => `${vs && i === 1 ? '<div class="vs">VS</div>' : ""}<img src="${src}">`).join("")}</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();
mkdirSync("public/blog", { recursive: true });
await sharp(png).jpeg({ quality: 80, mozjpeg: true }).toFile(`public/blog/${slug}.jpg`);
console.log(`wrote public/blog/${slug}.jpg`);
