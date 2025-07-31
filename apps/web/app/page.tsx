import TiptapEditor from './components/TiptapEditor'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-4xl">
        <TiptapEditor />
      </div>
    </main>
  )
}