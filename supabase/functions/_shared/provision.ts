export interface ParticipantRecord { id: string; email: string; status: string; profile_id: string | null; updated_at: string }
export interface AccountRecord { id: string; banned: boolean; managed: boolean }
export interface AppProfile { role: string; is_active: boolean; must_change_password: boolean }
export interface ProvisionGateway {
  participant: (id: string) => Promise<ParticipantRecord | null>
  findAccount: (email: string) => Promise<AccountRecord | null>
  profile: (id: string) => Promise<AppProfile | null>
  createAccount: (email: string, password: string) => Promise<AccountRecord>
  link: (participant: ParticipantRecord, userId: string, actorId: string) => Promise<void>
}
export class PublicError extends Error {
  status: number
  constructor(message: string, status = 400) { super(message); this.status = status }
}
export function generateTemporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return 'Aa9!' + Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
}
export async function provisionAccount(gateway: ProvisionGateway, actorId: string, participantId: string, action: string) {
  if (!/^[0-9a-f-]{36}$/i.test(participantId) || action !== 'provision') throw new PublicError('요청 형식이 올바르지 않습니다.')
  const participant = await gateway.participant(participantId)
  if (!participant || participant.status !== 'active') throw new PublicError('활성 참가자만 계정을 연결할 수 있습니다.')
  let account = await gateway.findAccount(participant.email)
  if (account?.banned) throw new PublicError('이 계정은 사용이 제한되어 있습니다.', 409)
  if (participant.profile_id && account?.id !== participant.profile_id) throw new PublicError('참가자와 인증 계정이 일치하지 않습니다.', 409)
  const profile = account ? await gateway.profile(account.id) : null
  if (profile && (profile.role !== 'student' || !profile.is_active)) throw new PublicError('기존 앱 역할 또는 비활성 계정을 자동 변경할 수 없습니다.', 409)
  let temporaryPassword: string | null = null
  let created = false
  if (!account) {
    temporaryPassword = generateTemporaryPassword()
    try { account = await gateway.createAccount(participant.email, temporaryPassword); created = true }
    catch {
      // A concurrent request may have created the same email. Never reset its password.
      account = await gateway.findAccount(participant.email)
      temporaryPassword = null
      if (!account) throw new PublicError('계정을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.', 502)
      if (account.banned) throw new PublicError('이 계정은 사용이 제한되어 있습니다.', 409)
    }
  }
  if (!account) throw new PublicError('인증 계정을 확인하지 못했습니다.', 502)
  try { await gateway.link(participant, account.id, actorId) }
  catch {
    // Preserve a newly issued credential in this response so a partial failure can be recovered.
    return { participantId, status: 'link_failed', temporaryPassword,
      message: '계정 연결 중 참가 정보가 변경되었거나 충돌했습니다. 목록을 새로고침한 뒤 계정 연결을 다시 실행해 주세요.' }
  }
  return { participantId, status: created ? 'created' : 'linked', temporaryPassword,
    message: temporaryPassword ? '임시 비밀번호를 안전하게 전달해 주세요. 최초 로그인 후 변경이 필요합니다.' : '기존 계정을 연결했습니다. 기존 비밀번호를 사용합니다.' }
}
