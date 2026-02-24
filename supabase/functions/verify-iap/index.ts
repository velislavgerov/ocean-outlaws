// Supabase Edge Function: verify-iap
// RevenueCat webhook receiver for entitlement sync.

interface RevenueCatEvent {
  event?: {
    app_user_id?: string;
    product_id?: string;
    type?: string;
    purchased_at_ms?: number;
  };
}

Deno.serve(async function (req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var body = (await req.json()) as RevenueCatEvent;
  if (!body.event || !body.event.app_user_id || !body.event.product_id) {
    return new Response(JSON.stringify({ error: 'invalid_webhook_payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: verify webhook signature + update entitlements in player_progression.ship_unlocks.
  return new Response(JSON.stringify({
    ok: true,
    eventType: body.event.type || 'unknown',
    appUserId: body.event.app_user_id,
    productId: body.event.product_id
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
