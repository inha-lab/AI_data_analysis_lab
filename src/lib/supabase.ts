import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// 환경변수가 없는 초기 개발 환경에서도 공개 화면은 실행된다.
export const supabase = url && key ? createClient(url, key) : null
export const isSupabaseConfigured = supabase !== null
