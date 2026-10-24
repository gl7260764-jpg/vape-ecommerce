import { searchProducts } from "@/lib/catalog-queries";

// GET /api/search?q=grape: up to 8 active products for the header search.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  const products = await searchProducts(q);
  return Response.json({ products }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
