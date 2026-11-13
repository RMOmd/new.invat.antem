import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG_KEY = 'romanian_supabase_config';

export const DEFAULT_SUPABASE_URL = 'https://mfkbyvlpsqefaifjtuaf.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_o650KaSdQdFRipbrDm5u7g_vn-8VTbB';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export function getSavedSupabaseConfig(): SupabaseConfig {
  const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        return parsed;
      }
    } catch (e) {
      // ignore
    }
  }
  return {
    url: (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_KEY
  };
}

export function isSupabaseConfigured(): boolean {
  const config = getSavedSupabaseConfig();
  return Boolean(config.url && config.anonKey);
}

export function saveSupabaseConfig(config: SupabaseConfig) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
  window.location.reload();
}

export function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
  window.location.reload();
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  const config = getSavedSupabaseConfig();
  if (config.url && config.anonKey) {
    try {
      supabaseInstance = createClient(config.url, config.anonKey);
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to create Supabase client', e);
    }
  }
  return null;
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!url || !anonKey) {
      return { success: false, message: 'URL-ul și cheia anonKey sunt obligatorii.' };
    }
    const client = createClient(url, anonKey);
    const { error } = await client.from('user_progress').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Conexiune reușită cu Supabase!' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Eroare la conectare.' };
  }
}
