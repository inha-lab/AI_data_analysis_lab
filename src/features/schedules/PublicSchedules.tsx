import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { isSupabaseConfigured } from '@/lib/supabase'
import { listPublicSchedules } from './schedule-api'
import type { ScheduleDisplay } from './schedule-model'
import { ScheduleList } from './ScheduleList'

export function PublicSchedules() {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; rows: ScheduleDisplay[]; error: string } | null>(null)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    void listPublicSchedules().then(rows => { if (active) setResult({ revision, rows, error: '' }) }).catch(() => { if (active) setResult({ revision, rows: [], error: '공개 일정을 불러오지 못했습니다.' }) })
    return () => { active = false }
  }, [revision])
  return <section className="section"><p className="eyebrow">PROGRAM CALENDAR</p><h2>공개 프로그램 일정</h2><p className="muted">운영진이 공개한 일정입니다. 모든 일시는 한국 시간(KST) 기준입니다.</p>
    {!isSupabaseConfigured ? <p className="notice">일정 서비스 연결을 준비하고 있습니다.</p> : result?.revision !== revision ? <p role="status">공개 일정을 불러오고 있습니다.</p>
      : result.error ? <div className="notice" role="alert"><p>{result.error}</p><Button onClick={() => setRevision(value => value + 1)}>다시 시도</Button></div> : <ScheduleList items={result.rows} />}
  </section>
}
