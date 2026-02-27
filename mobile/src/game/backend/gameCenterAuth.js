import { getSupabaseClient } from '../../services/supabaseClient';

export async function gameCenterAuth(payload) {
  var supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'missing_supabase_env' };
  }

  var result = await supabase.functions.invoke('game-center-auth', {
    body: payload
  });

  return {
    ok: !result.error,
    data: result.data,
    error: result.error || null
  };
}
