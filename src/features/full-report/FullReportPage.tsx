import { useEffect,useState } from 'react'
import { Link,useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { jobGroups } from '@/features/participants/participant-model'
import { proposalSections,proposalStatusLabels } from '@/features/proposals/proposal-model'
import { reportFields,reportStatusLabels,reportTypeLabels } from '@/features/reports/report-model'
import { safeTeamUrl,teamStages } from '@/features/teams/team-model'
import { loadFullReport } from './full-report-api'
import { buildFullReportHtml,formatKst,fullReportFilename,fullReportTitle,type FullReportData } from './full-report-model'

function ReportWorkspace({teamId}:{teamId:string}){
  const [revision,setRevision]=useState(0)
  const [result,setResult]=useState<{revision:number;data:FullReportData|null;error:string;generatedAt:string}|null>(null)
  useEffect(()=>{
    let active=true
    void loadFullReport(teamId).then(data=>{if(active)setResult({revision,data,error:'',generatedAt:new Date().toISOString()})}).catch(cause=>{if(active)setResult({revision,data:null,error:cause instanceof Error?cause.message:'전체리포트를 불러오지 못했습니다.',generatedAt:''})})
    return ()=>{active=false}
  },[teamId,revision])
  function download(data:FullReportData,generatedAt:string){
    const blob=new Blob([buildFullReportHtml(data,generatedAt)],{type:'text/html;charset=utf-8'})
    const url=URL.createObjectURL(blob)
    const anchor=document.createElement('a');anchor.href=url;anchor.download=fullReportFilename(data);document.body.append(anchor);anchor.click();anchor.remove()
    window.setTimeout(()=>URL.revokeObjectURL(url),60_000)
  }
  if(result?.revision!==revision)return <p role="status">전체리포트를 불러오고 있습니다.</p>
  if(!result.data)return <div className="notice" role="alert"><p>{result.error}</p><Button onClick={()=>setRevision(value=>value+1)}>다시 시도</Button></div>
  const {data,generatedAt}=result
  const {team,proposal,reports,members}=data
  const links=([['Notion',team.notion_url],['GitHub',team.github_url],['데모',team.demo_url]] as const).map(([label,value])=>({label,url:safeTeamUrl(value)})).filter(item=>Boolean(item.url))
  return <>
    <div className="page-heading report-actions"><div><p className="eyebrow">TEAM FULL REPORT</p><h1>팀 전체리포트</h1><p className="muted">{data.program_name} · {team.name}</p></div><div className="button-row"><Button className="button-secondary" onClick={()=>setRevision(value=>value+1)}>최신 내용 조회</Button><Button onClick={()=>window.print()}>인쇄</Button><Button onClick={()=>download(data,generatedAt)}>HTML 다운로드</Button></div></div>
    <p className="field-help report-actions">HTML 파일에는 팀원 이름과 프로젝트 내용이 포함됩니다. 저장·공유할 때 접근 범위를 확인해 주세요.</p>
    <article className="full-report"><header><h1>{fullReportTitle(data)}</h1><p>생성 일시: {formatKst(generatedAt)} KST</p></header>
      <section><h2>팀 정보</h2><p><strong>프로젝트 단계:</strong> {teamStages[team.stage]}</p><h3>프로젝트 주제</h3><p className="proposal-text">{team.topic||'미작성'}</p>{links.length>0&&<><h3>관련 URL</h3><ul>{links.map(item=><li key={item.label}><a className="text-link" href={item.url!} target="_blank" rel="noopener noreferrer">{item.label} ↗</a></li>)}</ul></>}</section>
      <section><h2>팀원 · {members.length}명</h2>{members.length?<ul>{members.map((member,index)=><li key={`${member.full_name}-${index}`}>{member.full_name}{member.is_leader?' (팀장)':''} · {member.department} · {jobGroups[member.job_group]}{!member.is_active?' · 비활성':''}</li>)}</ul>:<p>팀원이 없습니다.</p>}</section>
      <section><h2>프로젝트 기획서</h2>{proposal?<><p className="field-help">{proposalStatusLabels[proposal.status]} · 최종 변경 {proposal.updated_name} · {formatKst(proposal.updated_at)} KST{proposal.submitted_at&&` · 최근 제출 ${proposal.submitted_name} · ${formatKst(proposal.submitted_at)} KST`}</p><h3>{proposal.title}</h3>{proposalSections.map(item=><section className="full-report-field" key={item.key}><h4>{item.label}</h4><p className="proposal-text">{proposal[item.key]||'미작성'}</p></section>)}{safeTeamUrl(proposal.notion_url)&&<p><a className="text-link" href={safeTeamUrl(proposal.notion_url)!} target="_blank" rel="noopener noreferrer">기획서 Notion ↗</a></p>}{proposal.reviewed_at&&<p className="field-help">최근 검토 {proposal.reviewer_name} · {formatKst(proposal.reviewed_at)} KST<br />{proposal.review_note||'피드백 없음'}</p>}</>:<p>등록된 기획서가 없습니다.</p>}</section>
      <section><h2>일일·주간 보고서 · {reports.length}건</h2>{reports.length?reports.map(report=><article className="full-report-entry" key={report.id}><h3>{report.title}</h3><p className="field-help">{reportTypeLabels[report.report_type]} {report.round_number}회차 · 작성일 {report.report_date} · {reportStatusLabels[report.status]}</p><p className="field-help">최종 변경 {report.updated_name} · {formatKst(report.updated_at)} KST{report.submitted_at&&` · 최근 제출 ${report.submitted_name} · ${formatKst(report.submitted_at)} KST`}</p>{reportFields.map(item=><section className="full-report-field" key={item.key}><h4>{item.label}</h4><p className="proposal-text">{report[item.key]||'미작성'}</p></section>)}{report.reviewed_at&&<p className="field-help">최근 검토 {report.reviewer_name} · {formatKst(report.reviewed_at)} KST<br />{report.review_note||'피드백 없음'}</p>}</article>):<p>등록된 보고서가 없습니다.</p>}</section>
      <section><h2>산출물</h2><p>산출물 등록 기능 준비 중입니다.</p></section>
    </article>
    <p className="report-actions"><Link className="text-link" to={`/teams?cohort=${team.cohort_id}`}>팀 목록으로 →</Link></p>
  </>
}
export function FullReportPage(){
  const {teamId}=useParams()
  if(!teamId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))return <p role="alert">올바른 팀 주소가 아닙니다.</p>
  return <ReportWorkspace key={teamId} teamId={teamId}/>
}
