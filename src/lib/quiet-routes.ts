// Pages where the store never pops anything up: someone is buying, checking an order or their account.
// Product pages too: on a phone the app card sat over Add to cart, and they're where most searches land.
const QUIET = [/^\/product\//, /^\/checkout(\/|$)/, /^\/order\//, /^\/orders(\/|$)/, /^\/account(\/|$)/, /^\/invoice\//];

export const isQuietRoute = (pathname: string) => QUIET.some((r) => r.test(pathname));
