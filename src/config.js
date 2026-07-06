export function loadAppConfig() {
  return {
    apiBaseUrl: window.__APP_CONFIG__?.apiBaseUrl || 'http://127.0.0.1:8000',
    supabaseUrl: window.__APP_CONFIG__?.supabaseUrl || 'https://cyolmcowhfhymemmxgrn.supabase.co',
    supabaseAnonKey: window.__APP_CONFIG__?.supabaseAnonKey || ''
  };
}
