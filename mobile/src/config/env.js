export var SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export var SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export function hasSupabaseEnv() {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
