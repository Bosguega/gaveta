import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  supabaseUrl !== 'COLE_SUA_URL_AQUI';

if (!isConfigured) {
  console.warn('⚠️ Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
}

export const supabase = (() => {
  if (!isConfigured) return null;
  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn(
      '⚠️ Erro ao inicializar Supabase client. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
      err,
    );
    return null;
  }
})();

export const isSupabaseConfigured = isConfigured && Boolean(supabase);
