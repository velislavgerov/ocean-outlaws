// Supabase Edge Function: unlock-achievement
// Server-side achievement unlock gate.

interface AchievementRequest {
  playerId?: string;
  achievementId?: string;
  context?: Record<string, unknown>;
}

Deno.serve(async function (req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var body = (await req.json()) as AchievementRequest;
  if (!body.playerId || !body.achievementId) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: validate unlock criteria and write authoritative row.
  return new Response(JSON.stringify({
    ok: true,
    achievement: body.achievementId,
    playerId: body.playerId
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
