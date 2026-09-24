import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { reportTypeLabels } from '@/features/reports/report-model'
import { teamStages } from '@/features/teams/team-model'
import { loadProgramMonitoring, proposalRate, type ProgramMonitoring } from './program-monitoring'

export function ProgramMonitoringPanel({cohortId}:{cohortId:string}){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:ProgramMonitoring|null;error:string}|null>(null)
  const [roundType,setRoundType]=useState<'all'|'daily'|'weekly'>('all')
  useEffect(()=>{
    let active=true
    void loadProgramMonitoring(cohortId).then(data=>{if(active)setResult({revision,data,error:''})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'진행 현황을 불러오지 못했습니다.'})})
    return ()=>{active=false}
  },[cohortId,revision])
  const loading=result?.revision!==revision
  const data=loading?null:result.data
  return <section className="panel monitoring-panel"><div className="section-heading"><h2>프로그램 진행 현황</h2><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>새로고침</Button></div>
    {loading?<p role="status">팀 제출 현황을 불러오고 있습니다.</p>:result.error?<p className="form-error" role="alert">{result.error}</p>:data&&<>
      <div className="stats-grid"><article className="stat-card"><p>활성 참가자</p><strong>{data.active_participants}</strong><span>명</span></article><article className="stat-card"><p>팀</p><strong>{data.team_count}</strong><span>개 팀</span></article><article className="stat-card"><p>기획서 제출</p><strong>{data.proposal_submitted} / {data.team_count}</strong><span>{proposalRate(data.proposal_submitted,data.team_count)}</span></article><article className="stat-card"><p>검토할 이슈·지원 요청</p><strong>{data.teams.reduce((sum,team)=>sum+team.reports_needing_attention,0)}</strong><span>제출 보고서</span></article></div>
      <h3>팀별 현황</h3>{!data.teams.length?<p className="empty-state">이 프로그램에 등록된 팀이 없습니다.</p>:<div className="monitoring-table-wrap"><table className="monitoring-table"><thead><tr><th>팀·주제</th><th>단계</th><th>기획서</th><th>일일 제출</th><th>주간 제출</th><th>작성 중</th><th>이슈·지원 요청</th></tr></thead><tbody>{data.teams.map(team=><tr key={team.id}><td><strong>{team.name}</strong><small>{team.topic||'주제 미등록'}</small></td><td>{teamStages[team.stage]}</td><td><Link className="text-link" to={`/teams/${team.id}/proposal`}>{team.proposal_status==='reviewed'?'검토 완료':team.proposal_status==='submitted'?'제출':team.proposal_status==='draft'?'작성 중':'미작성'} →</Link></td><td><Link className="text-link" to={`/teams/${team.id}/reports`}>{team.daily_submitted}건</Link></td><td><Link className="text-link" to={`/teams/${team.id}/reports`}>{team.weekly_submitted}건</Link></td><td>{team.report_drafts}건</td><td><Link className="text-link" to={`/teams/${team.id}/reports`}>{team.reports_needing_attention}건</Link></td></tr>)}</tbody></table></div>}
      <div className="section-heading"><h3>보고 구분·회차별 제출</h3><select aria-label="보고 구분" value={roundType} onChange={event=>setRoundType(event.target.value as 'all'|'daily'|'weekly')}><option value="all">전체</option><option value="daily">일일</option><option value="weekly">주간</option></select></div>
      <p className="field-help">미제출 팀은 해당 구분·회차의 첫 보고서가 만들어진 후부터 표시합니다. 작성 중인 초안은 제출 건수에 포함하지 않습니다.</p>
      {!data.rounds.filter(round=>roundType==='all'||round.type===roundType).length?<p className="empty-state">등록된 회차가 없습니다.</p>:<div className="monitoring-rounds">{data.rounds.filter(round=>roundType==='all'||round.type===roundType).map(round=><article className="monitoring-round" key={`${round.type}-${round.round}`}><div><strong>{reportTypeLabels[round.type]} {round.round}회차</strong><span>{round.submitted_teams} / {data.team_count}팀 제출</span></div><p className="field-help">미제출 {round.missing_teams.length}팀{round.missing_teams.length?` · ${round.missing_teams.map(team=>team.name).join(', ')}`:''}</p></article>)}</div>}
    </>}
  </section>
}
