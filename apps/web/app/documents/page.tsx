import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import ConnectedEditor from '../components/ConnectedEditor'
import DocumentHeader from '../components/DocumentHeader'
import DocumentList from '../components/DocumentList'
import { DocumentProvider } from '../providers/DocumentProvider'

export default async function DocumentsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <DocumentProvider>
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
              <ConnectedEditor />
            </div>
          </div>
        </main>
      </div>
    </DocumentProvider>
  )
}