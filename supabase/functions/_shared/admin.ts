import { generateTemporaryPassword, PublicError } from './provision.ts'

export interface AdminInput { action?: unknown; email?: unknown; displayName?: unknown; phone?: unknown }
export interface NormalizedAdmin { email: string; displayName: string; phone: string }

export function normalizeAdmin(input: AdminInput): NormalizedAdmin {
  if (input.action !== 'create') throw new PublicError('요청 형식이 올바르지 않습니다.')
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const displayName = typeof input.displayName === 'string' ? input.displayName.trim() : ''
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  if (!displayName || displayName.length > 80) throw new PublicError('이름은 1~80자로 입력해 주세요.')
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PublicError('이메일 주소를 정확히 입력해 주세요.')
  const digits = phone.replace(/\D/g, '')
  if (!/^[0-9+()\-\s]+$/.test(phone) || digits.length < 9 || digits.length > 15) throw new PublicError('전화번호를 정확히 입력해 주세요.')
  return { email, displayName, phone }
}

export { generateTemporaryPassword }
