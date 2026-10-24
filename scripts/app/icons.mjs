// The app's icons until the store has a real logo: the lime "B" roundel from the header, as PNGs.
// Run: node scripts/app/icons.mjs
import sharp from "sharp";

const LIME = "#c9f060"; // --primary
const INK = "#0c1108"; // --primary-foreground

// rounded: a tile with its own corners (browsers and desktops show it as is).
// full bleed: the platform cuts the shape itself (Android "maskable", iPhone home screen), so the B
// stays inside the middle 60% for maskable.
const svg = (size, { rounded, letter }) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${rounded ? 22 : 0}" fill="${LIME}"/>
  <text x="50" y="${50 + letter * 0.36}" text-anchor="middle" font-family="DejaVu Sans" font-weight="bold" font-size="${letter}" fill="${INK}">B</text>
</svg>`;

const icons = [
  ["public/icons/icon-192.png", 192, { rounded: true, letter: 60 }],
  ["public/icons/icon-512.png", 512, { rounded: true, letter: 60 }],
  ["public/icons/maskable-512.png", 512, { rounded: false, letter: 44 }],
  ["src/app/apple-icon.png", 180, { rounded: false, letter: 58 }],
];
for (const [file, size, look] of icons) {
  await sharp(Buffer.from(svg(size, look))).png().toFile(file);
  console.log(file);
}
