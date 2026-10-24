// Pages where the store never pops anything up: someone is buying, checking an order or their account.
const QUIET = [/^\/checkout(\/|$)/, /^\/order\//, /^\/orders(\/|$)/, /^\/account(\/|$)/, /^\/invoice\//];

export const isQuietRoute = (pathname: string) => QUIET.some((r) => r.test(pathname));
