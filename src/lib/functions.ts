import { supabase } from './supabase'

export async function invokeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('데이터베이스 연결 설정이 필요합니다.')
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = '서버 요청에 실패했습니다. 연결과 로그인 상태를 확인해 주세요.'
    if ('context' in error && error.context instanceof Response) {
      try { const response = await error.context.json(); if (typeof response.error === 'string') message = response.error } catch { /* Never expose raw server responses. */ }
    }
    throw new Error(message)
  }
  return data as T
}
