import { useEffect, useState } from 'react'
import { listParticipants } from './participant-api'
import type { Participant } from './participant-model'

export function useParticipants(cohortId: string) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ cohortId: string; revision: number; data: Participant[]; error: string } | null>(null)
  useEffect(() => {
    let active = true
    void listParticipants(cohortId).then(data => {
      if (active) setResult({ cohortId, revision, data, error: '' })
    }).catch(error => {
      if (active) setResult({ cohortId, revision, data: [], error: error instanceof Error ? error.message : '참가자 목록을 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [cohortId, revision])
  const current = result?.cohortId === cohortId && result?.revision === revision
  return { participants: current ? result.data : [], loading: !current,
    error: current ? result.error : '', reload: () => setRevision(value => value + 1) }
}
