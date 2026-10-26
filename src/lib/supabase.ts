import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"] || "https://eqelwfhiizigduybtkxh.supabase.co";
// Publishable keys are safe in browser clients; RLS controls data access.
const supabaseAnonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || "sb_publishable_4a2QFks3jKlkExAb9Ber6g_f5oWJa8T";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
