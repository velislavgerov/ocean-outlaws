// Supabase Edge Function: submit-score
// Server-authoritative score ingestion with basic payload validation.

interface ScoreRequest {
  playerId?: string;
  waveReached?: number;
  score?: number;
  shipClass?: string;
  totalKills?: number;
}

Deno.serve(async function (req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  var body = (await req.json()) as ScoreRequest;
  if (!body.playerId || typeof body.waveReached !== 'number' || typeof body.score !== 'number' || !body.shipClass) {
    return new Response(JSON.stringify({ error: 'invalid_payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // TODO: anti-cheat validation + DB write.
  return new Response(JSON.stringify({
    ok: true,
    accepted: {
      playerId: body.playerId,
      waveReached: body.waveReached,
      score: body.score,
      shipClass: body.shipClass,
      totalKills: body.totalKills || 0
    }
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
});
