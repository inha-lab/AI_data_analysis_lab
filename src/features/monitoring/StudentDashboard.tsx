import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

interface Membership { id: string; cohort_id: string; full_name: string; department: string; student_number: string; grade: string }
export function StudentDashboard() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; rows: Membership[]; names: Record<string, string>; error: string } | null>(null)
  useEffect(() => {
    if (!supabase || !userId) return
    let active = true
    void Promise.all([
      supabase.from('AD_participants').select('id,cohort_id,full_name,department,student_number,grade').eq('profile_id', userId).eq('status', 'active'),
      supabase.from('AD_cohorts').select('id,name'),
    ]).then(([members, cohorts]) => {
      if (!active) return
      if (members.error || cohorts.error) setResult({ revision, rows: [], names: {}, error: '참여 정보를 불러오지 못했습니다.' })
      else setResult({ revision, rows: members.data as Membership[], names: Object.fromEntries(cohorts.data.map(row => [row.id, row.name])), error: '' })
    }).catch(() => { if (active) setResult({ revision, rows: [], names: {}, error: '서버에 연결하지 못했습니다.' }) })
    return () => { active = false }
  }, [userId, revision])
  return <><div className="page-heading"><div><p className="eyebrow">MY PROGRAM</p><h1>나의 프로그램</h1><p className="muted">참여 중인 기수와 등록 정보를 확인하세요.</p></div></div>
    {result?.revision !== revision ? <p role="status">참여 정보를 확인하고 있습니다.</p> : result.error ? <div role="alert" className="notice"><p>{result.error}</p><Button onClick={() => setRevision(value => value + 1)}>다시 시도</Button></div>
      : !result.rows.length ? <section className="panel empty-state"><h2>참여 중인 기수가 없습니다.</h2><p>참가 상태는 운영 담당자에게 문의해 주세요.</p></section>
        : <div className="membership-grid">{result.rows.map(row => <section className="panel" key={row.id}><span className="badge status-active">참여 중</span><h2>{result.names[row.cohort_id] ?? '참여 기수'}</h2><p>{row.full_name} · {row.department} · {row.grade}</p><p className="muted">학번 {row.student_number}</p><p className="field-help">팀과 프로젝트 화면은 순차적으로 제공됩니다.</p></section>)}</div>}
  </>
}
