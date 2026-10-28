// The picture link previews show (Facebook, X, iMessage, WhatsApp) for pages without a product photo of
// their own: the home page headline over the hero's vape cloud, 1200x630.
// Run: node scripts/app/og-image.mjs   (needs the internet for the Archivo font)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const cloud = readFileSync("public/hero/vape-cloud.jpg").toString("base64");
const html = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&display=block" rel="stylesheet">
<style>
  body { margin: 0; width: 1200px; height: 630px; overflow: hidden; position: relative; background: #0f1014; color: #f4f5f7; font-family: Archivo, sans-serif; }
  .cloud { position: absolute; inset: 0; background: url(data:image/jpeg;base64,${cloud}) right center / cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(90deg, #0f1014 0%, rgba(15,16,20,.82) 48%, rgba(15,16,20,.15) 100%); }
  .card { position: absolute; inset: 64px 72px; display: flex; flex-direction: column; }
  .logo { display: flex; align-items: center; gap: 16px; }
  .b { width: 56px; height: 56px; border-radius: 50%; background: #c9f060; color: #0c1108; display: grid; place-items: center; font-weight: 900; font-size: 26px; }
  .name { line-height: 1; } .name b { display: block; font-size: 26px; font-weight: 800; text-transform: uppercase; letter-spacing: -.01em; }
  .name span { font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: #b9bcc4; }
  h1 { margin: auto 0 0; font-size: 104px; line-height: .92; font-weight: 900; font-stretch: 112%; text-transform: uppercase; letter-spacing: -.035em; }
  h1 em { font-style: normal; color: #c9f060; display: block; }
  p { margin: 28px 0 0; font-size: 26px; color: #d6d8de; }
  .url { position: absolute; right: 0; top: 14px; font-size: 20px; color: #b9bcc4; }
</style></head><body>
  <div class="cloud"></div><div class="shade"></div>
  <div class="card">
    <div class="logo"><div class="b">B</div><div class="name"><b>Best Vape</b><span>Shop Australia</span></div></div>
    <div class="url">vapesupplieraustralia.com</div>
    <h1>Big clouds.<em>Better prices.</em></h1>
    <p>Genuine IGET, Alibarbar and HQD disposables. Tracked delivery Australia-wide.</p>
  </div>
</body></html>`;

const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: "png" });
await browser.close();
await sharp(png).jpeg({ quality: 82, mozjpeg: true }).toFile("public/og.jpg");
console.log("wrote public/og.jpg");
