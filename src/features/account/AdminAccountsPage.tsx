import { useEffect, useState, type FormEvent } from 'react'
import { Copy, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { createAdminAccount, deleteAdminAccount, listAdminAccounts, resetAdminPassword, updateAdminAccount, type AdminAccount, type CreatedAdmin } from './account-api'

export function AdminAccountsPage() {
  const { profile } = useAuth()
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [values, setValues] = useState({ displayName: '', email: '', phone: '', role: 'admin' as 'professor' | 'admin', isActive: true })
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [created, setCreated] = useState<CreatedAdmin | null>(null)
  const [resetCredential, setResetCredential] = useState<{ name: string; password: string } | null>(null)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function load() { setLoading(true); setError(''); void listAdminAccounts().then(setAdmins).catch(cause => setError(cause instanceof Error ? cause.message : '불러오지 못했습니다.')).finally(() => setLoading(false)) }
  useEffect(() => { void listAdminAccounts().then(setAdmins).catch(cause => setError(cause instanceof Error ? cause.message : '불러오지 못했습니다.')).finally(() => setLoading(false)) }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setCreated(null); setResetCredential(null)
    try { if(editing){await updateAdminAccount(editing.id,values);setEditing(null)}else{const result=await createAdminAccount(values);setCreated(result)} setValues({ displayName: '', email: '', phone: '', role: 'admin', isActive: true }); load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : '관리자를 등록하지 못했습니다.') }
    finally { setBusy(false) }
  }
  return <><div className="page-heading"><div><p className="eyebrow">ADMIN MANAGEMENT</p><h1>관리자 관리</h1><p className="muted">교수 관리자 또는 운영 관리자 계정을 등록합니다.</p></div></div>
    {created && <section className="notice credential-notice" role="status"><ShieldCheck size={22} aria-hidden="true" /><div><h2>{created.admin.display_name} 관리자 등록 완료</h2>{created.existingAccount?<p>{created.admin.email} · 기존 로그인 계정에 관리자 권한을 연결했습니다. 기존 비밀번호로 로그인할 수 있습니다.</p>:<><p>{created.admin.email} · 임시 비밀번호는 이 화면에서 한 번만 표시됩니다.</p><code>{created.temporaryPassword}</code><Button className="button-secondary" onClick={() => created.temporaryPassword&&void navigator.clipboard.writeText(created.temporaryPassword)}><Copy size={15} aria-hidden="true" /> 복사</Button></>}</div></section>}
    {resetCredential&&<section className="notice credential-notice" role="status"><ShieldCheck size={22} aria-hidden="true" /><div><h2>{resetCredential.name} 비밀번호 초기화 완료</h2><p>전화번호에서 010을 제외한 숫자 8자리로 초기화했습니다. 다음 로그인 시 비밀번호를 변경해야 합니다.</p><code>{resetCredential.password}</code><Button className="button-secondary" onClick={()=>void navigator.clipboard.writeText(resetCredential.password)}><Copy size={15} aria-hidden="true" /> 복사</Button></div></section>}
    <div className="admin-account-grid"><section className="panel editor-panel"><h2>{editing?'관리자 정보 수정':'관리자 추가 등록'}</h2><p className="muted">{editing?'이름·전화번호·역할과 활성 상태를 관리합니다.':'등록한 신규 계정은 최초 로그인 시 비밀번호를 변경해야 합니다.'}</p><form className="cohort-form" onSubmit={submit}><fieldset disabled={busy}>
      <label htmlFor="admin-name">이름 *</label><input id="admin-name" value={values.displayName} onChange={event => setValues(current => ({ ...current, displayName: event.target.value }))} maxLength={80} required />
      <label htmlFor="admin-email">이메일 *</label><input id="admin-email" type="email" value={values.email} onChange={event => setValues(current => ({ ...current, email: event.target.value }))} maxLength={254} autoComplete="off" disabled={Boolean(editing)} required />
      <label htmlFor="admin-phone">전화번호 *</label><input id="admin-phone" type="tel" value={values.phone} onChange={event => setValues(current => ({ ...current, phone: event.target.value }))} maxLength={30} required />
      <label htmlFor="admin-role">관리자 역할 *</label><select id="admin-role" value={values.role} onChange={event => setValues(current => ({ ...current, role: event.target.value as 'professor' | 'admin' }))}><option value="admin">관리자</option><option value="professor">교수 관리자</option></select>
      {editing&&<label className="admin-active-toggle"><input type="checkbox" checked={values.isActive} onChange={event=>setValues(current=>({...current,isActive:event.target.checked}))}/> 활성 계정</label>}
      <p className="field-help">관리자는 프로그램 운영 기능을 사용할 수 있지만 다른 관리자를 추가할 수 없습니다.</p>
      {error && <p className="form-error" role="alert">{error}</p>}<div className="button-row"><Button type="submit"><Plus size={16} aria-hidden="true" />{busy?(editing?'저장 중…':'등록 중…'):(editing?'변경 저장':'관리자 등록')}</Button>{editing&&<><Button type="button" className="button-secondary" onClick={()=>{if(!window.confirm(`${editing.display_name||editing.email} 관리자의 비밀번호를 전화번호 뒤 8자리로 초기화할까요?`))return;setBusy(true);setError('');setResetCredential(null);void resetAdminPassword(editing.id).then(password=>setResetCredential({name:editing.display_name||editing.email,password})).catch(cause=>setError(cause instanceof Error?cause.message:'비밀번호를 초기화하지 못했습니다.')).finally(()=>setBusy(false))}}>비밀번호 초기화</Button><Button type="button" className="button-secondary" onClick={()=>{setEditing(null);setError('');setValues({displayName:'',email:'',phone:'',role:'admin',isActive:true})}}>취소</Button></>}</div>
    </fieldset></form></section>
    <section className="panel"><div className="section-heading"><h2>등록된 관리자 <span className="badge">{admins.length}명</span></h2><Button className="button-secondary" onClick={load} disabled={loading} aria-label="관리자 목록 새로고침"><RefreshCw size={16} aria-hidden="true" /></Button></div>
      {loading ? <p className="empty-state" role="status">관리자 목록을 불러오고 있습니다.</p> : !admins.length ? <p className="empty-state">등록된 관리자가 없습니다.</p> : <div className="admin-list">{admins.map(admin => <article key={admin.id}><div><strong>{admin.display_name || '이름 미등록'} <span className="badge">{admin.role === 'professor' ? '교수 관리자' : '관리자'}</span></strong><p>{admin.email}</p><small>{admin.phone || '전화번호 미등록'}</small></div><div className="admin-list-actions"><span className={`badge ${admin.is_active ? 'status-active' : 'status-completed'}`}>{admin.is_active ? '활성' : '비활성'}</span>{admin.id!==profile?.id&&<><Button className="button-secondary" onClick={()=>{setCreated(null);setError('');setEditing(admin);setValues({displayName:admin.display_name||'',email:admin.email,phone:admin.phone||'',role:admin.role,isActive:admin.is_active})}}>수정</Button><Button className="button-secondary" disabled={busy} onClick={()=>{if(!window.confirm(`${admin.display_name||admin.email} 관리자의 권한을 삭제할까요?`))return;setBusy(true);setError('');void deleteAdminAccount(admin.id).then(()=>{if(editing?.id===admin.id)setEditing(null);load()}).catch(cause=>setError(cause instanceof Error?cause.message:'관리자 권한을 삭제하지 못했습니다.')).finally(()=>setBusy(false))}}>삭제</Button></>}</div></article>)}</div>}
    </section></div></>
}
