# Buying searches: what Australians type, and how titles use it

*Researched 20 November 2026 from Google's Australian autocomplete (`hl=en-AU&gl=au`): 410 seed phrases
(general terms, every brand and range we stock, with "vape", "australia", "flavours", "puffs", "price", "bulk",
"near me"), 2,933 suggestions. The blog's informational questions are in [docs/blog/backlog.md](../blog/backlog.md).*

## What people search

| Kind | Most common phrasings |
| --- | --- |
| General | disposable vapes australia, vapes online australia, buy vapes online australia, cheap vapes australia, vape shop australia, vapes near me |
| Cities | vapes perth / melbourne / brisbane / sydney / adelaide, vape delivery melbourne / brisbane / perth, disposable vapes perth / adelaide / brisbane |
| Bulk | vape bulk buy australia, vapes bulk cheap, iget vapes bulk cheap australia, vape wholesale australia |
| Liquids and pouches | e liquid australia, vape juice australia, vape juice with nicotine australia, nicotine pouches australia |
| Range + puffs | iget bar pro 10000 puffs, alibarbar ingot 9000, hqd cuvie slick 6000, iget one 12000, iget legend 4000 puffs, iget moon 5000, hqd click plus 30000, airmez xbeats 40000 puffs |
| Range + flavours | iget bar pro flavours, iget one flavours, alibarbar flavours, iget bar plus flavours, iget legend flavours, hqd cuvie slick flavours |
| Range + price / nicotine | iget bar pro price, alibarbar vape price in australia, iget bar pro nicotine content, iget one nicotine content |
| Trust | iget vapes original, iget bar australia legit, alibarbar australia reviews |

"Flavours" is spelled the Australian way in nearly every suggestion, and puff counts are typed without commas.

## How the titles use it (src/lib/seo.ts)

- **Products**: range, puff count and flavour first ("HQD Cuvie Slick 6000 Puffs - Strawberry Kiwi"), then what
  it is plus Australia ("| Disposable Vape Australia", shortened to "| Vape Australia" or "| Vape AU" to stay
  within 60 characters). Packs end "| Bulk Buy Australia". Descriptions say "Buy the ... disposable vape in
  <flavour> for $X", nicotine when known, "genuine stock" and tracked delivery.
- **Ranges**: "IGET Bar Pro 10000 Puffs: All Flavours | Australia".
- **Brands with their own category**: "Alibarbar Vapes Australia: All Flavours & Models".
- **Main shelves**: written by hand (`SHELVES`): "Disposable Vapes Australia: Buy Vapes Online", "E-Liquids & Vape
  Juice Australia: Buy Online", "Vape Bulk Buy Australia: Wholesale Vape Packs".
- **Home**: "Buy Vapes Online Australia | Best Vape Shop Australia"; the description names the capital cities.
- THC and CBD products under legal review keep their plain titles.

Check the whole catalogue after any change: `node --env-file=.env.local --conditions=react-server --import tsx scripts/seo/audit-meta.mts`
(read-only; prints lengths, duplicates and samples).
