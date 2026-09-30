import { authenticate, body, handle, json } from '../_shared/http.ts'
import { PublicError } from '../_shared/provision.ts'
import { validateNewPassword } from '../_shared/password.ts'

Deno.serve(handle(async request => {
  const { admin, user, profile } = await authenticate(request, false)
  const input = await body(request)
  const password = input.password
  const validation = validateNewPassword(password)
  if (validation) throw new PublicError(validation)
  const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    method: 'PUT', headers: { Authorization: request.headers.get('Authorization')!, apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new PublicError('비밀번호를 변경하지 못했습니다. 기존 비밀번호와 다른 값을 사용하고 계정 정책을 확인해 주세요.', 400)
  const { error: profileError } = profile.must_change_password
    ? await admin.from('AD_profiles').update({ must_change_password: false, updated_at: new Date().toISOString() }).eq('id', user.id).eq('must_change_password', true)
    : { error: null }
  if (profileError) throw new PublicError('비밀번호는 변경되었지만 설정 완료 처리에 실패했습니다. 새 비밀번호로 로그인한 뒤 다시 변경해 주세요.', 503)
  return json({ ok: true })
}))
