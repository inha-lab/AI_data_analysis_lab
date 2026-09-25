export type GpuChoice='0'|'1'|'both'
export type ReservationInput={teamId:string;day:string;start:string;end:string;choice:GpuChoice;purpose:string}
export type GpuReservation={id:string;team_id:string|null;program_name:string;team_name:string;gpu_ids:number[];starts_at:string;ends_at:string;purpose:string;can_cancel:boolean}
export type TeamOption={id:string;name:string}
export function kstDay(date=new Date()){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date)
  const part=(name:string)=>parts.find(item=>item.type===name)?.value??''
  return `${part('year')}-${part('month')}-${part('day')}`
}
export function reservationTimes(input:Pick<ReservationInput,'day'|'start'|'end'>){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.day)||!/^\d{2}:\d{2}$/.test(input.start)||!/^\d{2}:\d{2}$/.test(input.end))return null
  const start=Date.parse(`${input.day}T${input.start}:00+09:00`)
  const endBase=Date.parse(`${input.day}T${input.end}:00+09:00`)
  if(!Number.isFinite(start)||!Number.isFinite(endBase))return null
  const startCheck=new Date(start+9*3600000).toISOString().slice(0,16)
  const endCheck=new Date(endBase+9*3600000).toISOString().slice(0,16)
  if(startCheck!==`${input.day}T${input.start}`||endCheck!==`${input.day}T${input.end}`)return null
  const end=endBase+(endBase<=start?86400000:0)
  return {start:new Date(start),end:new Date(end)}
}
export function validateReservation(input:ReservationInput){
  if(!input.teamId)return '팀을 선택해 주세요.'
  if(!reservationTimes(input))return '예약일과 시작·종료 시간을 확인해 주세요.'
  if(!['0','1','both'].includes(input.choice))return 'GPU를 선택해 주세요.'
  if(!input.purpose.trim()||input.purpose.trim().length>500)return '사용 목적은 1~500자로 입력해 주세요.'
  return ''
}
export function gpuIds(choice:GpuChoice){return choice==='both'?[0,1]:[Number(choice)]}
