import { invokeFunction } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { normalizeProfileInput, validateAdminInput, validateProfileInput, type AdminInput, type ProfileInput } from './account-model'

export interface AdminAccount { id: string; email: string; display_name: string | null; phone: string | null; role: 'professor' | 'admin'; is_active: boolean; created_at: string }
export interface CreatedAdmin { admin: AdminAccount; temporaryPassword: string }

function client() { if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.'); return supabase }

export async function listAdminAccounts(): Promise<AdminAccount[]> {
  const { data, error } = await client().rpc('AD_admin_accounts')
  if (error) throw new Error(error.code === '42501' ? '관리자 조회 권한이 없습니다.' : '관리자 목록을 불러오지 못했습니다.')
  return data as AdminAccount[]
}

export async function createAdminAccount(input: AdminInput): Promise<CreatedAdmin> {
  const validation = validateAdminInput(input)
  if (validation) throw new Error(validation)
  const value = normalizeProfileInput(input)
  return invokeFunction<CreatedAdmin>('ad-create-admin', { action: 'create', email: input.email.trim().toLowerCase(), role: input.role, ...value })
}

export interface MyAcademicProfile { department: string; grade: string; job_group: 'sw_engineering' | 'sw_development' | 'ai_development' | 'other'; job_group_other: string | null }
export async function getMyAcademicProfile(): Promise<MyAcademicProfile | null> {
  const { data, error } = await client().rpc('AD_my_academic_profile')
  if (error) throw new Error('학적 정보를 불러오지 못했습니다.')
  return (data as MyAcademicProfile[])[0] ?? null
}
export async function updateMyProfile(input: ProfileInput & Partial<MyAcademicProfile>) {
  const validation = validateProfileInput(input)
  if (validation) throw new Error(validation)
  const value = normalizeProfileInput(input)
  const { data, error } = await client().rpc('AD_update_my_profile_v2', { p_display_name: value.displayName, p_phone: value.phone,
    p_department: input.department ?? null, p_grade: input.grade ?? null, p_job_group: input.job_group ?? null, p_job_group_other: input.job_group_other ?? null })
  if (error) throw new Error(error.code === '42501' ? '개인정보 수정 권한이 없습니다. 다시 로그인해 주세요.' : '개인정보를 저장하지 못했습니다.')
  return (data as Array<{ id: string; display_name: string; phone: string }>)[0]
}
