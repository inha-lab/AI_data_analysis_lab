import { createHashRouter } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { DashboardLayout } from '@/components/layouts/DashboardLayout'
import { HomeEntry } from '@/pages/HomeEntry'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createHashRouter([
  { element: <PublicLayout />, children: [
    { path: '/', element: <HomeEntry /> },
    { path: '/login', element: <LoginPage /> },
    { path: '*', element: <NotFoundPage /> },
  ] },
  { element: <RequireAuth />, children: [
    { path: '/change-password', lazy: async () => ({ Component: (await import('@/features/auth/ChangePasswordPage')).ChangePasswordPage }) },
    { element: <DashboardLayout />, children: [
      { path: '/dashboard', lazy: async () => ({ Component: (await import('@/features/monitoring/DashboardPage')).DashboardPage }) },
      { element: <RequireAuth roles={['professor', 'student']} />, children: [
        { path: '/schedules', lazy: async () => ({ Component: (await import('@/features/schedules/SchedulesPage')).SchedulesPage }) },
        { path: '/teams', lazy: async () => ({ Component: (await import('@/features/teams/TeamsPage')).TeamsPage }) },
        { path: '/teams/:teamId/proposal', lazy: async () => ({ Component: (await import('@/features/proposals/ProposalPage')).ProposalPage }) },
        { path: '/teams/:teamId/reports', lazy: async () => ({ Component: (await import('@/features/reports/ReportPage')).ReportPage }) },
      ] },
      { element: <RequireAuth roles={['professor']} />, children: [
        { path: '/cohorts', lazy: async () => ({ Component: (await import('@/features/cohorts/CohortsPage')).CohortsPage }) },
        { path: '/participants', lazy: async () => ({ Component: (await import('@/features/participants/ParticipantsPage')).ParticipantsPage }) },
      ] },
    ] },
  ] },
])
