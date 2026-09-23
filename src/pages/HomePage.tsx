import { Link } from 'react-router-dom'

const stages = ['프로젝트 기획', '설계', '구현', '발표', '산출물 확인']
export function HomePage() {
  return <>
    <section className="hero"><p className="eyebrow">INHA UNIVERSITY · PROJECT BASED LEARNING</p>
      <h1>데이터로 질문하고,<br />AI로 가능성을 만듭니다.</h1>
      <p className="intro">공공데이터에서 문제를 발견하고 팀과 함께 해결합니다.<br />기획부터 최종 발표까지, 프로젝트의 모든 과정을 한곳에서.</p>
      <Link className="button" to="/login">프로그램 참여하기 →</Link>
    </section>
    <section className="section"><p className="eyebrow">PROJECT JOURNEY</p><h2>팀과 함께 완성하는 다섯 단계</h2>
      <div className="stage-grid">{stages.map((stage, index) => <article className="stage-card" key={stage}><span>0{index + 1}</span><h3>{stage}</h3></article>)}</div>
    </section>
    <section className="notice"><h2>프로그램 안내</h2><p>기수별 일정과 참여 안내는 운영 설정 후 제공됩니다. 현재는 기본 구조를 준비한 화면입니다.</p></section>
  </>
}
