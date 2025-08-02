import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import TiptapEditor from './components/TiptapEditor'
import DocumentHeader from './components/DocumentHeader'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="user-dashboard">
      <DocumentHeader />
      <main className="flex flex-col items-center p-6">
        <div className="w-full max-w-4xl">
          <div className="rounded-lg bg-white shadow-sm">
            <TiptapEditor />
          </div>
        </div>
      </main>
    </div>
  )
}