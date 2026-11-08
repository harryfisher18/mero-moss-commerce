import { analyticsBeaconSchema } from "@/domain/analytics/funnel";
import { trackEvent } from "@/server/analytics";
import { getCurrentCart } from "@/server/cart-session";
import { getProduct } from "@/server/catalog";

/**
 * Same-origin beacon for the two funnel steps only a browser can observe. Nothing the
 * browser sends is trusted: the product and cart are looked up on the server, and values
 * come from those records.
 */

const MAX_BODY_BYTES = 1024;

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

const empty = (status: number) => new Response(null, { status });

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return empty(403);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return empty(413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return empty(400);
  }
  const beacon = analyticsBeaconSchema.safeParse(body);
  if (!beacon.success) return empty(400);

  if (beacon.data.name === "view_item") {
    const product = await getProduct(beacon.data.productHandle);
    if (!product) return empty(404);
    await trackEvent({ name: "view_item", productId: product.id });
    return empty(204);
  }

  const cart = await getCurrentCart();
  if (cart.lines.length === 0 || cart.hasIssues) return empty(204);
  await trackEvent({
    name: "begin_checkout",
    quantity: cart.totals.itemCount,
    value: cart.totals.estimatedTotal,
  });
  return empty(204);
}
