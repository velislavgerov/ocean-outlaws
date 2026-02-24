import { getSupabaseClient } from '../../services/supabaseClient';

export async function submitScore(payload) {
  var supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'missing_supabase_env' };
  }

  var result = await supabase.functions.invoke('submit-score', {
    body: payload
  });

  return {
    ok: !result.error,
    data: result.data,
    error: result.error || null
  };
}

export async function unlockAchievement(payload) {
  var supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, reason: 'missing_supabase_env' };
  }

  var result = await supabase.functions.invoke('unlock-achievement', {
    body: payload
  });

  return {
    ok: !result.error,
    data: result.data,
    error: result.error || null
  };
}
