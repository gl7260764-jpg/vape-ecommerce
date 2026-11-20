// The app's icons until the store has a real logo: the lime "B" roundel from the header, as PNGs.
// Run: node scripts/app/icons.mjs
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const LIME = "#c9f060"; // --primary
const INK = "#0c1108"; // --primary-foreground

// rounded: a tile with its own corners (browsers and desktops show it as is).
// round: the header's roundel, for the browser tab and Google's results.
// full bleed: the platform cuts the shape itself (Android "maskable", iPhone home screen), so the B
// stays inside the middle 60% for maskable.
const svg = (size, { rounded, round, letter }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${round ? 50 : rounded ? 22 : 0}" fill="${LIME}"/>
  <text x="50" y="${50 + letter * 0.36}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${letter}" fill="${INK}">B</text>
</svg>`;
const png = (size, look) => sharp(Buffer.from(svg(size, look))).png().toBuffer();

const ROUND = { round: true, letter: 64 };
const icons = [
  ["public/icons/icon-192.png", 192, { rounded: true, letter: 60 }],
  ["public/icons/icon-512.png", 512, { rounded: true, letter: 60 }],
  ["public/icons/maskable-512.png", 512, { rounded: false, letter: 44 }],
  ["src/app/apple-icon.png", 180, { rounded: false, letter: 58 }],
  // Google shows a site's icon in search results only when it is square and a multiple of 48px
  // (48, 96, 144...); the old 64px one never qualified, so results showed a blank globe.
  ["src/app/icon.png", 96, ROUND],
];
for (const [file, size, look] of icons) {
  writeFileSync(file, await png(size, look));
  console.log(file);
}

// /favicon.ico: what browsers and crawlers ask for first. An ICO file holding PNGs at 48, 32 and 16px.
const sizes = [48, 32, 16];
const images = await Promise.all(sizes.map((s) => png(s, ROUND)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const at = 6 + 16 * i;
  header.writeUInt8(s, at); // width
  header.writeUInt8(s, at + 1); // height
  header.writeUInt8(0, at + 2); // palette colours
  header.writeUInt8(0, at + 3); // reserved
  header.writeUInt16LE(1, at + 4); // colour planes
  header.writeUInt16LE(32, at + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, at + 8);
  header.writeUInt32LE(offset, at + 12);
  offset += images[i].length;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...images]));
console.log("src/app/favicon.ico");
