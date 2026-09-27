import { generateTemporaryPassword, PublicError } from './provision.ts'

export interface AdminInput { action?: unknown; email?: unknown; displayName?: unknown; phone?: unknown; role?: unknown }
export interface NormalizedAdmin { email: string; displayName: string; phone: string; role: 'professor' | 'admin' }
export interface ExistingAdminProfile { role: string; is_active: boolean }

export function normalizeAdmin(input: AdminInput): NormalizedAdmin {
  if (input.action !== 'create') throw new PublicError('요청 형식이 올바르지 않습니다.')
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const role = input.role
  if (!displayName || displayName.length > 80) throw new PublicError('이름은 1~80자로 입력해 주세요.')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicError('이메일 주소를 정확히 입력해 주세요.')
  const digits = phone.replace(/\D/g, '')
  if (!/^[0-9+()\-\s]+$/.test(phone) || digits.length < 9 || digits.length > 15) throw new PublicError('전화번호를 정확히 입력해 주세요.')
  if (role !== 'professor' && role !== 'admin') throw new PublicError('관리자 역할을 선택해 주세요.')
  return { email, displayName, phone, role }
}

export function assertAdminAccountAvailable(profile: ExistingAdminProfile | null) {
  if (!profile) return
  if (profile.role === 'professor' || profile.role === 'admin') throw new PublicError('이미 등록된 관리자입니다.', 409)
  throw new PublicError('이미 이 서비스의 다른 역할로 등록된 사용자입니다. 기존 역할을 먼저 확인해 주세요.', 409)
}

export function normalizeAdminTarget(input: { id?: unknown; isActive?: unknown }) {
  const id = typeof input.id === 'string' ? input.id.trim() : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new PublicError('관리자 식별 정보가 올바르지 않습니다.')
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw new PublicError('관리자 상태가 올바르지 않습니다.')
  return { id, isActive: input.isActive === true }
}

export function temporaryPasswordFromPhone(phone: string | null) {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!/^010\d{8}$/.test(digits)) throw new PublicError('전화번호가 010-XXXX-XXXX 형식이어야 비밀번호를 초기화할 수 있습니다.', 409)
  return digits.slice(3)
}

export { generateTemporaryPassword }
