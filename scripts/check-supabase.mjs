import { loadEnv } from 'vite'

const env = loadEnv('development', process.cwd(), 'VITE_')
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Supabase URL and public key are required')
if (new URL(url).origin !== 'https://pyiltnkahsdscuotlenw.supabase.co') throw new Error('Unexpected Supabase project')
if (key.startsWith('sb_secret_')) throw new Error('Do not use a server key in VITE variables')
if (key.split('.').length === 3) {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
  if (payload.role !== 'anon') throw new Error('Expected a public anon key')
}
for (const path of ['/auth/v1/settings', '/rest/v1/AD_profiles?select=id&limit=0', '/rest/v1/AD_cohorts?select=id&limit=0', '/rest/v1/AD_participants?select=id&limit=0']) {
  try {
    const response = await fetch(new URL(path, url), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.json()
    console.log(JSON.stringify({ endpoint: path, status: response.status, code: body.code ?? null }))
    // Anonymous reads of this private table must be denied after provisioning.
    const accessDenied = path.startsWith('/rest/') && response.status === 401 && body.code === '42501'
    if (!response.ok && !accessDenied) process.exitCode = 1
    if (accessDenied) console.log('App table exists; anonymous access is denied as expected')
  } catch {
    console.error('Supabase network request failed (credentials omitted)')
    process.exitCode = 1
  }
}
