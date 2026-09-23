import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Separate this app's persisted session from other apps sharing the project.
export const supabase = url && key ? createClient(url, key, {
  auth: {
    storageKey: 'AD_auth_session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
}) : null
export const isSupabaseConfigured = supabase !== null
