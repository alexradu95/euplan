import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import TiptapEditor from './components/TiptapEditor'
import DocumentHeader from './components/DocumentHeader'
import DocumentList from './components/DocumentList'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="user-dashboard">
      <DocumentHeader />
      <main className="flex gap-6 p-6">
        {/* Document List Sidebar */}
        <div className="w-80 flex-shrink-0">
          <DocumentList />
        </div>
        
        {/* Editor */}
        <div className="flex-1">
          <div className="rounded-lg bg-white shadow-sm">
            <TiptapEditor />
          </div>
        </div>
      </main>
    </div>
  )
}