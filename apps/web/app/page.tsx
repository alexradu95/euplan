import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import TiptapEditor from './components/TiptapEditor'

export default async function Home() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-4xl">
        <div className="mb-4 text-right">
          <span className="text-gray-600">
            Logged in as: {session.user?.email}
          </span>
        </div>
        <TiptapEditor />
      </div>
    </main>
  )
}