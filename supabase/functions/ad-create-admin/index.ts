import { assertAdminAccountAvailable, normalizeAdmin, normalizeAdminTarget, temporaryPasswordFromPhone, generateTemporaryPassword } from '../_shared/admin.ts'
import { PublicError } from '../_shared/provision.ts'
import { authenticate, body, handle, json } from '../_shared/http.ts'

Deno.serve(handle(async request => {
  const { admin, user } = await authenticate(request, 'professor')
  const payload = await body(request)
  if (payload.action === 'update' || payload.action === 'delete' || payload.action === 'reset_password') {
    const target = normalizeAdminTarget(payload)
    if (target.id === user.id) throw new PublicError('현재 로그인한 교수 관리자 본인의 권한은 여기에서 변경할 수 없습니다.', 409)
    const { data: current, error: currentError } = await admin.from('AD_profiles').select('id,display_name,phone,role,is_active,created_at').eq('id', target.id).in('role', ['professor', 'admin']).maybeSingle()
    if (currentError) throw new PublicError('관리자 정보를 확인하지 못했습니다.', 502)
    if (!current) throw new PublicError('관리자 정보를 찾을 수 없습니다.', 404)
    if (payload.action === 'reset_password') {
      const temporaryPassword = temporaryPasswordFromPhone(current.phone)
      const { error: passwordError } = await admin.auth.admin.updateUserById(target.id, { password: temporaryPassword })
      if (passwordError) throw new PublicError('관리자 비밀번호를 초기화하지 못했습니다.', 502)
      const { error: profileError } = await admin.from('AD_profiles').update({ must_change_password: true, updated_at: new Date().toISOString() }).eq('id', target.id)
      if (profileError) throw new PublicError('비밀번호는 변경되었지만 최초 변경 상태를 저장하지 못했습니다. 관리자에게 문의해 주세요.', 502)
      return json({ temporaryPassword })
    }
    if (payload.action === 'delete') {
      const { error } = await admin.from('AD_profiles').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', target.id)
      if (error) throw new PublicError('관리자 권한을 삭제하지 못했습니다.', 502)
      return json({ success: true })
    }
    const input = normalizeAdmin({ ...payload, action: 'create' })
    const { error } = await admin.from('AD_profiles').update({ display_name: input.displayName, phone: input.phone, role: input.role, is_active: target.isActive, updated_at: new Date().toISOString() }).eq('id', target.id)
    if (error) throw new PublicError('관리자 정보를 수정하지 못했습니다.', 502)
    return json({ admin: { ...current, display_name: input.displayName, phone: input.phone, role: input.role, is_active: target.isActive, email: input.email } })
  }
  const input = normalizeAdmin(payload)
  const { data: existing, error: lookupError } = await admin.rpc('AD_find_auth_user', { p_email: input.email })
  if (lookupError) throw lookupError
  if (existing) {
    const { data: account, error: accountError } = await admin.auth.admin.getUserById(existing)
    if (accountError || !account.user) throw new PublicError('기존 로그인 계정을 확인하지 못했습니다.', 502)
    if (account.user.banned_until && new Date(account.user.banned_until) > new Date()) throw new PublicError('사용이 제한된 계정에는 관리자 권한을 연결할 수 없습니다.', 409)
    const { data: profile, error: profileError } = await admin.from('AD_profiles').select('role,is_active').eq('id', existing).maybeSingle()
    if (profileError) throw new PublicError('기존 사용자 정보를 확인하지 못했습니다.', 502)
    assertAdminAccountAvailable(profile)
    const createdAt = new Date().toISOString()
    const { error: insertError } = await admin.from('AD_profiles').insert({ id: existing, display_name: input.displayName, phone: input.phone, role: input.role, must_change_password: false })
    if (insertError) throw new PublicError(insertError.code === '23505' ? '이미 등록된 관리자입니다.' : '기존 계정에 관리자 권한을 연결하지 못했습니다.', insertError.code === '23505' ? 409 : 502)
    return json({ admin: { id: existing, email: input.email, display_name: input.displayName, phone: input.phone, role: input.role, is_active: true, created_at: createdAt }, temporaryPassword: null, existingAccount: true })
  }
  const temporaryPassword = generateTemporaryPassword()
  const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: temporaryPassword, email_confirm: true, app_metadata: { ad_lab_created: true } })
  if (error || !data.user) throw new PublicError('관리자 계정을 생성하지 못했습니다.', 502)
  const createdAt = new Date().toISOString()
  const { error: profileError } = await admin.from('AD_profiles').insert({ id: data.user.id, display_name: input.displayName, phone: input.phone, role: input.role, must_change_password: true })
  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id)
    throw new PublicError('관리자 정보를 저장하지 못했습니다.', 502)
  }
  return json({ admin: { id: data.user.id, email: input.email, display_name: input.displayName, phone: input.phone, role: input.role, is_active: true, created_at: createdAt }, temporaryPassword, existingAccount: false })
}))
