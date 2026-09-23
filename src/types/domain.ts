export type UserRole = 'professor' | 'consultant' | 'researcher' | 'student'
export type ProjectStage = 'planning' | 'design' | 'implementation' | 'presentation' | 'review'
export type SubmissionStatus = 'draft' | 'submitted' | 'reviewed'

// DB 스키마 확정 전 화면 골격용 타입. 실제 생성 DB 타입과 구분한다.
export type { Cohort } from '@/features/cohorts/cohort-model'
export interface Team { id: string; cohortId: string; name: string; topic: string; stage: ProjectStage }
