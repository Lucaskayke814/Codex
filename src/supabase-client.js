import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

export function initializeSupabaseClient(config = {}) {
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('Supabase URL ou chave anon não configurados. O cliente não foi inicializado.');
    return null;
  }

  try {
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (error) {
    console.error('Falha ao inicializar o cliente do Supabase.', error);
    return null;
  }
}
