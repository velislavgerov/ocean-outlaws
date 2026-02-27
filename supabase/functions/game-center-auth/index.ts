// Supabase Edge Function: game-center-auth
// Verifies Apple Game Center signature server-side and returns app session payload.

interface AuthRequest {
  gameCenterId?: string;
  displayName?: string;
  signature?: string;
  publicKeyUrl?: string;
  salt?: string;
  timestamp?: number;
}

Deno.serve(async function (req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var body = (await req.json()) as AuthRequest;
  if (!body.gameCenterId) {
    return new Response(JSON.stringify({ error: 'missing_game_center_id' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: verify signature with Apple and mint Supabase session token.
  return new Response(JSON.stringify({
    ok: true,
    player: {
      gameCenterId: body.gameCenterId,
      displayName: body.displayName || 'Captain',
      platform: 'ios'
    },
    session: null,
    todo: 'Implement Apple signature verification + Supabase auth token minting'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
