import { Link } from 'react-router-dom'
import { PublicSchedules } from '@/features/schedules/PublicSchedules'

const stages = [
  {
    title: '프로젝트 기획',
    subtitle: '문제 정의',
    description: '사회·지역 문제 발굴, 분석 질문(가설) 설정',
  },
  {
    title: '설계',
    subtitle: '데이터 확보·탐색',
    description: '공공데이터포털 수집, 정제·결합, 탐색적 분석(EDA)',
  },
  {
    title: '구현',
    subtitle: 'AI 분석·모델링',
    description: '분석 기법이나 모델 적용, 성능과 타당성 검증',
  },
  {
    title: '발표',
    subtitle: '인사이트·발표',
    description: '시사점 도출, 정책·서비스 제안, 시각화',
  },
  {
    title: '성과 공유',
    subtitle: '성과 공유·회고',
    description: '코드·데이터·보고서 정리와 공개',
  },
]
export function HomePage() {
  return <>
    <section className="hero"><p className="eyebrow">INHA UNIVERSITY · PROJECT BASED LEARNING</p>
      <h1>데이터로 질문하고,<br />AI로 가능성을 만듭니다.</h1>
      <p className="intro">공공데이터에서 문제를 발견하고 팀과 함께 해결합니다.<br />기획부터 최종 발표까지, 프로젝트의 모든 과정을 한곳에서.</p>
      <Link className="button" to="/login">프로그램 참여하기 →</Link>
    </section>
    <section className="section"><p className="eyebrow">PROJECT JOURNEY</p><h2>팀과 함께 완성하는 다섯 단계</h2>
      <div className="stage-grid">{stages.map((stage, index) => <article className="stage-card" key={stage.title}>
        <span>0{index + 1}</span>
        <h3>{stage.title}</h3>
        <strong>{stage.subtitle}</strong>
        <p>{stage.description}</p>
      </article>)}</div>
    </section>
    <PublicSchedules />
  </>
}
