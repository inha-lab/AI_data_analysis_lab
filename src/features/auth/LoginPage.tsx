import { Link } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'

export function LoginPage() {
  return <section className="login-card"><p className="eyebrow">MEMBER ACCESS</p><h1>프로그램 로그인</h1>
    <p>선발된 참가자는 관리자가 등록한 계정으로 참여합니다.</p>
    <div className="notice" role="status">{isSupabaseConfigured ? 'Supabase 환경 설정이 감지되었습니다. 실제 연결 검증과 로그인·역할별 접근 제어는 후속 구현 예정입니다.' : 'Supabase 연결 설정 전입니다. 로그인 기능은 계정·권한 정책 확정 후 연결됩니다.'}</div>
    <Link to="/">← 프로그램 소개로 돌아가기</Link>
  </section>
}
