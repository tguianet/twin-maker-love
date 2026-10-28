import { createClient, type User } from "@supabase/supabase-js";

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

type AppUserResult = { data: { user: User | null }; error: Error | null };
let devAccess: Promise<void> | null = null;

/**
 * Development mode without a login screen. When nobody is signed in, the app signs in
 * with an anonymous Supabase user and joins the restaurant marked with dev_open_access
 * (migration 20261028110000_dev_open_access.sql). RLS and server functions keep working
 * because every request still has a real authenticated user behind it.
 * Use this instead of supabase.auth.getUser() everywhere in the app.
 */
export async function getAppUser(): Promise<AppUserResult> {
  if (!devAccess) {
    devAccess = (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          throw new Error(/anonymous/i.test(error.message)
            ? "Entrada sem login desativada no Supabase. Ligue \"Allow anonymous sign-ins\" em Authentication → Sign In / Providers."
            : "Não foi possível entrar automaticamente: " + error.message);
        }
      }
      const { data: current } = await supabase.auth.getUser();
      const { error: joinError } = await supabase.rpc("join_dev_organization");
      // A real (e-mail) user keeps working even before the migration is applied.
      if (joinError && current.user?.is_anonymous) {
        throw new Error("Rode a migration 20261028110000_dev_open_access.sql no Supabase para liberar o acesso sem login. (" + joinError.message + ")");
      }
    })().catch((error: unknown) => { devAccess = null; throw error; });
  }
  try {
    await devAccess;
  } catch (error) {
    return { data: { user: null }, error: error instanceof Error ? error : new Error(String(error)) };
  }
  const result = await supabase.auth.getUser();
  return { data: { user: result.data.user }, error: result.error };
}
