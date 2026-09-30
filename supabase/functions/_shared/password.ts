export function validateNewPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) return '비밀번호는 8~128자로 입력해 주세요.'
  return ''
}
