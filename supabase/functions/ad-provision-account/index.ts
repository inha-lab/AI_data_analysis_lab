import { authenticate, body, handle, json } from '../_shared/http.ts'
import { provisionAccount, PublicError, type ProvisionGateway, type AccountRecord } from '../_shared/provision.ts'

Deno.serve(handle(async request => {
  const { admin, user } = await authenticate(request, true)
  const input = await body(request)
  if (typeof input.participantId !== 'string' || typeof input.action !== 'string') throw new PublicError('참가자와 작업을 지정해 주세요.')
  const accountRecord = (account: { id: string; banned_until?: string; app_metadata: Record<string, unknown> }): AccountRecord => ({
    id: account.id, banned: Boolean(account.banned_until && Date.parse(account.banned_until) > Date.now()), managed: account.app_metadata.ad_lab_created === true,
  })
  const gateway: ProvisionGateway = {
    async participant(id) {
      const { data, error } = await admin.from('AD_participants').select('id,email,status,profile_id,updated_at').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async findAccount(email) {
      const { data: id, error } = await admin.rpc('AD_find_auth_user', { p_email: email })
      if (error) throw error
      if (!id) return null
      const { data, error: lookupError } = await admin.auth.admin.getUserById(id)
      if (lookupError || !data.user) throw lookupError ?? new Error('Account unavailable')
      return accountRecord(data.user)
    },
    async profile(id) {
      const { data, error } = await admin.from('AD_profiles').select('role,is_active,must_change_password').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async createAccount(email, password) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { ad_lab_created: true } })
      if (error || !data.user) throw error ?? new Error('Account creation failed')
      return accountRecord(data.user)
    },
    async link(participant, userId, actorId) {
      const { error } = await admin.rpc('AD_link_participant_account', { p_participant: participant.id, p_user: userId, p_actor: actorId, p_email: participant.email, p_version: participant.updated_at })
      if (error) throw error
    },
  }
  return json(await provisionAccount(gateway, user.id, input.participantId, input.action))
}))
