import { createHashRouter } from 'react-router-dom'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/features/auth/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// GitHub Pages에서 하위 화면 새로고침을 지원하는 초기 라우팅 방식.
export const router = createHashRouter([
  { element: <PublicLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '*', element: <NotFoundPage /> },
  ] },
])
