export interface ProfileInput { displayName: string; phone: string }
export interface AdminInput extends ProfileInput { email: string; role: 'professor' | 'admin' }

export function normalizeProfileInput(input: ProfileInput): ProfileInput {
  return { displayName: input.displayName.trim(), phone: input.phone.trim() }
}

export function validateProfileInput(input: ProfileInput): string {
  const value = normalizeProfileInput(input)
  if (!value.displayName || value.displayName.length > 80) return '이름은 1~80자로 입력해 주세요.'
  const digits = value.phone.replace(/\D/g, '')
  if (!/^[0-9+()\-\s]+$/.test(value.phone) || digits.length < 9 || digits.length > 15) return '연락처를 정확히 입력해 주세요.'
  return ''
}

export function validateAdminInput(input: AdminInput): string {
  const profileError = validateProfileInput(input)
  if (profileError) return profileError
  const email = input.email.trim().toLowerCase()
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '이메일 주소를 정확히 입력해 주세요.'
  if (input.role !== 'professor' && input.role !== 'admin') return '관리자 역할을 선택해 주세요.'
  return ''
}
