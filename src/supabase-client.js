import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export function initializeSupabaseClient(config) {
  return createClient(config.supabaseUrl, config.supabaseAnonKey);
}
