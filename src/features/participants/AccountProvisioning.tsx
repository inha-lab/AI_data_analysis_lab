import { useEffect, useState } from 'react'
import { useBlocker } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { invokeFunction } from '@/lib/functions'
import type { Participant } from './participant-model'

interface Result { participantId: string; status: string; temporaryPassword: string | null; message: string; email: string }
export function AccountProvisioning({ participants, onChanged, onBusy, locked }: { locked: boolean; participants: Participant[]; onChanged: () => void; onBusy: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<Result[]>([])
  const [visible, setVisible] = useState(false)
  const pending = participants.filter(item => item.status === 'active' && !item.profile_id)
  const hasPasswords = results.some(item => item.temporaryPassword)
  const blocker = useBlocker(hasPasswords || busy)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (!busy && window.confirm('임시 비밀번호를 안전하게 전달·보관했나요? 화면을 떠나면 발급 결과가 사라집니다.')) blocker.proceed()
    else blocker.reset()
  }, [blocker, busy])
  useEffect(() => {
    if (!hasPasswords && !busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasPasswords, busy])
  async function provision() {
    if (!pending.length || !window.confirm(`${pending.length}명의 계정을 생성 또는 연결할까요? 기존 계정의 비밀번호는 유지됩니다.`)) return
    if (hasPasswords && !window.confirm('앞서 발급된 임시 비밀번호를 별도로 전달·보관했나요? 새 결과로 바뀌면 다시 표시할 수 없습니다.')) return
    setBusy(true); onBusy(true); setResults([]); setVisible(false)
    for (const participant of pending) {
      let result: Result
      try {
        const response = await invokeFunction<Omit<Result, 'email'>>('ad-provision-account', { participantId: participant.id, action: 'provision' })
        result = { ...response, email: participant.email }
      } catch (cause) { result = { participantId: participant.id, status: 'error', temporaryPassword: null, message: cause instanceof Error ? cause.message : '처리에 실패했습니다.', email: participant.email } }
      setResults(current => [...current, result])
    }
    setBusy(false); onBusy(false); onChanged()
  }
  return <section className="panel account-panel"><div className="section-heading"><div><h2>로그인 계정 연결</h2><p className="muted">활성 참가자 중 계정 연결 대기 {pending.length}명</p></div><Button disabled={locked || busy || !pending.length} onClick={() => void provision()}>{busy ? `처리 중 · ${results.length}/${pending.length}` : '대기 계정 일괄 처리'}</Button></div>
    <p className="field-help">새 계정의 임시 비밀번호는 이번 결과에서만 확인할 수 있습니다. 기존 계정은 기존 비밀번호를 사용합니다. 이메일은 자동 발송하지 않습니다.</p>
    {results.length > 0 && <><div className="button-row"><Button className="button-secondary" onClick={() => setVisible(value => !value)}>{visible ? '임시 비밀번호 숨기기' : '임시 비밀번호 보기'}</Button><Button className="button-secondary" disabled={busy} onClick={() => { if (!hasPasswords || window.confirm('임시 비밀번호를 안전하게 전달·보관했나요? 화면에서 지우면 다시 표시할 수 없습니다.')) setResults([]) }}>결과 지우기</Button></div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>이메일</th><th>결과</th><th>임시 비밀번호</th></tr></thead><tbody>{results.map(result => <tr key={result.participantId}><td>{result.email}</td><td className="result-message">{result.message}</td><td>{result.temporaryPassword ? <code>{visible ? result.temporaryPassword : '••••••••••••'}</code> : '—'}</td></tr>)}</tbody></table></div>
      {hasPasswords && <p className="field-help">화면을 떠나기 전에 결과를 확인해 주세요. 임시 비밀번호 원문은 DB나 브라우저 저장소에 저장하지 않습니다.</p>}
    </>}
  </section>
}
