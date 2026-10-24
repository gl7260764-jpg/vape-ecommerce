// Brands and categories for the catalog import. Category slugs and IDs match the
// live store; names are tidied and taglines are new. `aliases` drive brand
// detection in product names (case-insensitive, whole words).

export type BrandSeed = { slug: string; name: string; aliases: string[] };

export const brands: BrandSeed[] = [
  { slug: "iget", name: "IGET", aliases: ["iget"] },
  { slug: "hqd", name: "HQD", aliases: ["hqd"] },
  { slug: "alibarbar", name: "Alibarbar", aliases: ["alibarbar", "ali barbar"] },
  { slug: "geek-bar", name: "Geek Bar", aliases: ["geek bar", "geekbar", "geek pulse"] },
  { slug: "airmez", name: "Airmez", aliases: ["airmez"] },
  { slug: "ace", name: "ACE", aliases: ["ace ultra"] },
  { slug: "muha-meds", name: "Muha Meds", aliases: ["muha meds", "muhameds", "muha"] },
  { slug: "bar-juice", name: "Bar Juice 5000", aliases: ["bar juice"] },
  { slug: "nasty-juice", name: "Nasty Juice", aliases: ["nasty"] },
  { slug: "vapengin", name: "Vapengin", aliases: ["vapengin"] },
  { slug: "supreme-cbd", name: "Supreme CBD", aliases: ["supreme cbd"] },
  { slug: "freemax", name: "Freemax", aliases: ["freemax"] },
  { slug: "smok", name: "SMOK", aliases: ["smok"] },
  { slug: "uwell", name: "Uwell", aliases: ["uwell", "caliburn"] },
  { slug: "geekvape", name: "GeekVape", aliases: ["geekvape", "geek vape"] },
  { slug: "lost-vape", name: "Lost Vape", aliases: ["lost vape"] },
  { slug: "aspire", name: "Aspire", aliases: ["aspire"] },
  { slug: "voopoo", name: "Voopoo", aliases: ["voopoo"] },
  { slug: "vaporesso", name: "Vaporesso", aliases: ["vaporesso"] },
  { slug: "yocan", name: "Yocan", aliases: ["yocan"] },
  { slug: "utillian", name: "Utillian", aliases: ["utillian"] },
  { slug: "ryot", name: "RYOT", aliases: ["ryot"] },
  { slug: "elev8", name: "Elev8", aliases: ["elev8", "elev8r"] },
  { slug: "fruitbae", name: "FruitBae", aliases: ["fruitbae"] },
  { slug: "cloud-nurdz", name: "Cloud Nurdz", aliases: ["cloud nurdz"] },
  { slug: "vital", name: "Vital", aliases: ["vital"] },
  { slug: "kapow", name: "Kapow", aliases: ["kapow"] },
  { slug: "aisu", name: "Aisu", aliases: ["aisu"] },
  { slug: "dinner-lady", name: "Dinner Lady", aliases: ["dinner lady"] },
  { slug: "berry-drop", name: "Berry Drop", aliases: ["berry drop"] },
  { slug: "juiced-up", name: "Juiced Up", aliases: ["juiced up"] },
  { slug: "charlies-chalk-dust", name: "Charlie's Chalk Dust", aliases: ["charlie’s chalk", "charlie's chalk", "charlies chalk"] },
  { slug: "flip-juice", name: "Flip Juice", aliases: ["flip juice"] },
  { slug: "cushty-juice", name: "Cushty Juice", aliases: ["cushty"] },
  { slug: "crikey-clouds", name: "Crikey Clouds", aliases: ["crikey clouds"] },
  { slug: "blackwood", name: "Blackwood", aliases: ["blackwood"] },
  { slug: "blvk-unicorn", name: "BLVK Unicorn", aliases: ["blvk"] },
];

export type CategorySeed = {
  slug: string;
  name: string;
  kind: "type" | "brand" | "series" | "collection";
  brand?: string; // Brand slug
  parent?: string; // Category slug
  tagline: string;
  featured?: number; // position in the homepage "Shop by brand" grid
  hidden?: boolean;
  /** Puffs every product in this series has, used when a product name doesn't say. */
  puffs?: number;
  review?: string;
};

const LEGAL = "Legal check: confirm this range can be sold in Australia before showing it.";

export const categories: CategorySeed[] = [
  { slug: "disposable-vapes", name: "Disposable Vapes", kind: "type", tagline: "Disposables and pod devices from more brands." },
  { slug: "e-liquids", name: "E-Liquids", kind: "type", tagline: "Freebase and nicotine salt e-liquids." },
  { slug: "eliquide-juice", name: "E-Juice", kind: "type", parent: "e-liquids", tagline: "More e-liquid brands, including large bottles." },
  { slug: "vape-accessories", name: "Vape Accessories", kind: "type", tagline: "Coils, pods, chargers and kits." },
  { slug: "tanks", name: "Tanks", kind: "type", parent: "vape-accessories", tagline: "Sub-ohm tanks." },
  { slug: "glass-bongs", name: "Glass Bongs", kind: "type", tagline: "Glass pieces and fittings.", review: LEGAL },

  { slug: "iget-bar-australia", name: "IGET Bar", kind: "series", brand: "iget", tagline: "The original IGET Bar, 3,500 puffs.", puffs: 3500 },
  { slug: "iget-bar-plus", name: "IGET Bar Plus", kind: "series", brand: "iget", tagline: "IGET's bigger bar, up to 6,000 puffs.", puffs: 6000 },
  { slug: "iget-bar-pro", name: "IGET Bar Pro", kind: "series", brand: "iget", tagline: "IGET Bar Pro, 10,000 puffs.", puffs: 10000 },
  { slug: "iget-moon", name: "IGET Moon", kind: "series", brand: "iget", tagline: "IGET Moon, 5,000 puffs.", puffs: 5000 },
  { slug: "iget-legend", name: "IGET Legend", kind: "series", brand: "iget", tagline: "IGET Legend, 4,000 puffs.", puffs: 4000 },
  { slug: "iget-xxl", name: "IGET XXL", kind: "series", brand: "iget", tagline: "Compact IGET XXL, 1,800 puffs.", puffs: 1800 },
  { slug: "iget-goat-vape", name: "IGET Goat", kind: "series", brand: "iget", tagline: "IGET Goat, 5,000 puffs.", puffs: 5000 },
  { slug: "iget-one-12000", name: "IGET One", kind: "series", brand: "iget", tagline: "IGET One, 12,000 puffs.", puffs: 12000 },
  { slug: "iget-flare-b10000", name: "IGET Flare", kind: "series", brand: "iget", tagline: "IGET Flare, 10,000 puffs.", puffs: 10000 },
  { slug: "iget-halo-vape-kit", name: "IGET Halo", kind: "series", brand: "iget", tagline: "IGET Halo kits and pods." },
  { slug: "iget-shion-x1-nicotine-pouch", name: "IGET Shion X1 Pouches", kind: "series", brand: "iget", tagline: "Nicotine pouches from IGET's Shion range." },

  { slug: "hqd-cuvie-slick-20000", name: "HQD Cuvie Slick 20000", kind: "series", brand: "hqd", tagline: "HQD Cuvie Slick, 20,000 puffs.", puffs: 20000 },
  { slug: "hqd-cuvie-slick-6000", name: "HQD Cuvie Slick 6000", kind: "series", brand: "hqd", tagline: "The slim HQD Cuvie Slick, 6,000 puffs.", puffs: 6000 },
  { slug: "hqd-click-plus-30000", name: "HQD Click Plus", kind: "series", brand: "hqd", tagline: "HQD Click Plus, 30,000 puffs.", puffs: 30000 },
  { slug: "hqd-miracle-8000", name: "HQD Miracle", kind: "series", brand: "hqd", tagline: "HQD Miracle, 8,000 puffs.", puffs: 8000 },

  { slug: "alibarbar", name: "Alibarbar", kind: "brand", brand: "alibarbar", tagline: "Gold-finish bars with big fruit blends.", featured: 1 },
  { slug: "alibarbar-pandora", name: "Alibarbar Pandora", kind: "series", brand: "alibarbar", parent: "alibarbar", tagline: "Alibarbar Pandora, 7,000 puffs.", puffs: 7000 },
  { slug: "alibarbar-upload-25000-puffs", name: "Alibarbar Upload", kind: "series", brand: "alibarbar", parent: "alibarbar", tagline: "Alibarbar Upload, 25,000 puffs.", puffs: 25000 },
  { slug: "alibarbar-ingot", name: "Alibarbar Ingot", kind: "series", brand: "alibarbar", parent: "alibarbar", tagline: "Pick five Ingot flavours. Best value per bar.", puffs: 9000, featured: 4 },

  { slug: "geek-bar", name: "Geek Bar", kind: "brand", brand: "geek-bar", tagline: "Geek Bar disposables, including the Pulse range." },
  { slug: "geek-pulse-9000", name: "Geek Bar Pulse 9000", kind: "series", brand: "geek-bar", parent: "geek-bar", tagline: "Geek Bar Pulse, 9,000 puffs.", puffs: 9000 },

  { slug: "airmez-xbeats-40000-puffs", name: "Airmez Xbeats", kind: "series", brand: "airmez", tagline: "40,000 puffs with a live screen.", puffs: 40000, featured: 2 },
  { slug: "ace-ultra-premium-vape", name: "ACE Ultra Premium", kind: "series", brand: "ace", tagline: "Boxed premium devices.", featured: 3, review: LEGAL },

  { slug: "muhameds-disposable", name: "Muha Meds", kind: "brand", brand: "muha-meds", tagline: "Muha Meds disposables.", review: LEGAL },
  { slug: "muhameds-disposable-3500-mg", name: "Muha Meds 3500 mg", kind: "series", brand: "muha-meds", parent: "muhameds-disposable", tagline: "The Muha Meds 3,500 mg range.", review: LEGAL },
  { slug: "supreme-cbd", name: "Supreme CBD", kind: "brand", brand: "supreme-cbd", tagline: "The Supreme CBD range.", review: LEGAL },

  { slug: "bar-juice-5000-nicotine-salt-e-liquid", name: "Bar Juice 5000", kind: "brand", brand: "bar-juice", parent: "e-liquids", tagline: "Nicotine salt e-liquids from Bar Juice 5000." },
  { slug: "nasty-juice", name: "Nasty Juice", kind: "brand", brand: "nasty-juice", parent: "e-liquids", tagline: "Nasty Juice e-liquids." },
  { slug: "vapengin-e-liquid", name: "Vapengin", kind: "brand", brand: "vapengin", parent: "e-liquids", tagline: "Vapengin e-liquids." },
  { slug: "freemax-coils", name: "Freemax Coils", kind: "series", brand: "freemax", parent: "vape-accessories", tagline: "Replacement coils from Freemax." },

  { slug: "iget-vapes-bulk-buy", name: "IGET Bulk Buy", kind: "collection", brand: "iget", tagline: "IGET packs, priced by the box." },
  { slug: "bulk-buy", name: "Bulk Buy", kind: "collection", tagline: "Mixed-brand packs of 10, 20 and 100." },
  { slug: "uncategorized", name: "Uncategorized", kind: "collection", tagline: "", hidden: true },
];
