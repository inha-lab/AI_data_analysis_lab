import { loadEnv } from 'vite'
const env = loadEnv('development', process.cwd(), 'VITE_')
if (env.VITE_SUPABASE_URL !== 'https://pyiltnkahsdscuotlenw.supabase.co') throw new Error('Unexpected project')
for (const name of ['ad-provision-account', 'ad-change-password']) {
  for (const [label, method, authorization, expected] of [
    ['preflight', 'OPTIONS', null, 200], ['method', 'GET', null, 405],
    ['missing-auth', 'POST', null, 401], ['invalid-auth', 'POST', 'Bearer invalid-token', 401],
    ['anon-key', 'POST', `Bearer ${env.VITE_SUPABASE_ANON_KEY}`, 401],
  ]) {
    const headers = { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }
    if (authorization) headers.Authorization = authorization
    const response = await fetch(`${env.VITE_SUPABASE_URL}/functions/v1/${name}`, { method, headers, body: method === 'POST' ? '{}' : undefined, signal: AbortSignal.timeout(20000) })
    console.log(JSON.stringify({ function: name, check: label, status: response.status, expected }))
    if (response.status !== expected) process.exitCode = 1
  }
}
