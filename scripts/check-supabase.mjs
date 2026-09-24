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
for (const path of ['/auth/v1/settings', '/rest/v1/AD_profiles?select=id&limit=0', '/rest/v1/AD_cohorts?select=id&limit=0', '/rest/v1/AD_participants?select=id&limit=0', '/rest/v1/AD_schedules?select=id&limit=0', '/rest/v1/AD_teams?select=id&limit=0', '/rest/v1/AD_team_members?select=team_id&limit=0', '/rest/v1/rpc/AD_team_workspace?p_cohort=00000000-0000-0000-0000-000000000000']) {
  try {
    const response = await fetch(new URL(path, url), {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    })
    const body = await response.json()
    console.log(JSON.stringify({ endpoint: path, status: response.status, code: body.code ?? null }))
    // Anonymous reads of this private table must be denied after provisioning.
    const accessDenied = path.startsWith('/rest/') && response.status === 401 && body.code === '42501'
    if (path.startsWith('/rest/') ? !accessDenied : !response.ok) process.exitCode = 1
    if (accessDenied) console.log('Private app endpoint denies anonymous access as expected')
  } catch {
    console.error('Supabase network request failed (credentials omitted)')
    process.exitCode = 1
  }
}
try {
  const response = await fetch(new URL('/rest/v1/rpc/AD_public_schedules?limit=1', url), {
    headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000),
  })
  const body = await response.json()
  const allowed = new Set(['id', 'cohort_id', 'program_name', 'title', 'description', 'stage', 'kind', 'starts_at', 'ends_at', 'is_cancelled'])
  if (!response.ok || !Array.isArray(body) || body.some(row => Object.keys(row).some(column => !allowed.has(column)))) process.exitCode = 1
  console.log(JSON.stringify({ endpoint: 'AD_public_schedules', status: response.status, validProjection: Array.isArray(body) && body.every(row => Object.keys(row).every(column => allowed.has(column))) }))
} catch {
  console.error('Public schedule request failed (credentials omitted)')
  process.exitCode = 1
}
