import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null | undefined;

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return Boolean(url && serviceRoleKey);
}

export function getSupabaseAdminClient(): SupabaseClient | undefined {
  if (!isSupabaseConfigured()) {
    return undefined;
  }

  if (cachedClient === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
    cachedClient = createClient(url, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return cachedClient ?? undefined;
}
