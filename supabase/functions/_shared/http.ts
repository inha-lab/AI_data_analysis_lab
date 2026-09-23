import { createClient } from 'npm:@supabase/supabase-js@2.117.1'
import { PublicError } from './provision.ts'

export const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
export function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }) }
export async function authenticate(request: Request, professorOnly: boolean) {
  const url = Deno.env.get('SUPABASE_URL')!
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const authorization = request.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) throw new PublicError('로그인이 필요합니다.', 401)
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.auth.getUser(authorization.slice(7))
  if (error || !data.user) throw new PublicError('로그인이 만료되었습니다. 다시 로그인해 주세요.', 401)
  const { data: profile, error: profileError } = await admin.from('AD_profiles').select('role,is_active,must_change_password').eq('id', data.user.id).maybeSingle()
  if (profileError) throw new PublicError('권한 확인에 실패했습니다.', 503)
  if (!profile?.is_active || (professorOnly && (profile.role !== 'professor' || profile.must_change_password))) throw new PublicError('이 작업을 수행할 권한이 없습니다.', 403)
  return { admin, user: data.user, profile }
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (text.length > 8192) throw new PublicError('요청이 너무 큽니다.', 413)
  try { const result = JSON.parse(text); if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(); return result }
  catch { throw new PublicError('잘못된 요청입니다.') }
}
export function handle(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors })
    if (request.method !== 'POST') return json({ error: '허용되지 않는 요청입니다.' }, 405)
    try { return await handler(request) }
    catch (error) { return json({ error: error instanceof PublicError ? error.message : '서버 처리에 실패했습니다. 다시 시도해 주세요.' }, error instanceof PublicError ? error.status : 500) }
  }
}
