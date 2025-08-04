import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { DashboardProvider } from './providers/DashboardProvider'
import DashboardLayout from './components/DashboardLayout'

export default async function DashboardPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <DashboardProvider>
      <DashboardLayout />
    </DashboardProvider>
  )
}