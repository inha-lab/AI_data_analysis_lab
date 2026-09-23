import { useEffect, useState } from 'react'
import { listCohorts } from './cohort-api'
import type { Cohort } from './cohort-model'

export function useCohorts() {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ revision: number; data: Cohort[]; error: string } | null>(null)
  useEffect(() => {
    let active = true
    void listCohorts().then(data => {
      if (active) setResult({ revision, data, error: '' })
    }).catch(error => {
      if (active) setResult({ revision, data: [], error: error instanceof Error ? error.message : '기수 목록을 불러오지 못했습니다.' })
    })
    return () => { active = false }
  }, [revision])
  return { cohorts: result?.data ?? [], loading: result?.revision !== revision,
    error: result?.revision === revision ? result.error : '', reload: () => setRevision(value => value + 1) }
}
