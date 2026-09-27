import { normalizeAdmin, generateTemporaryPassword } from '../_shared/admin.ts'
import { PublicError } from '../_shared/provision.ts'
import { authenticate, body, handle, json } from '../_shared/http.ts'

Deno.serve(handle(async request => {
  const { admin } = await authenticate(request, true)
  const input = normalizeAdmin(await body(request))
  const { data: existing, error: lookupError } = await admin.rpc('AD_find_auth_user', { p_email: input.email })
  if (lookupError) throw lookupError
  if (existing) throw new PublicError('이미 사용 중인 이메일입니다.', 409)
  const temporaryPassword = generateTemporaryPassword()
  const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: temporaryPassword, email_confirm: true, app_metadata: { ad_lab_created: true } })
  if (error || !data.user) throw new PublicError('관리자 계정을 생성하지 못했습니다.', 502)
  const createdAt = new Date().toISOString()
  const { error: profileError } = await admin.from('AD_profiles').insert({ id: data.user.id, display_name: input.displayName, phone: input.phone, role: 'professor', must_change_password: true })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new PublicError('관리자 정보를 저장하지 못했습니다.', 502)
  }
  return json({ admin: { id: data.user.id, email: input.email, display_name: input.displayName, phone: input.phone, is_active: true, created_at: createdAt }, temporaryPassword })
}))
