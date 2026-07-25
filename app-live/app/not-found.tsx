import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="text-4xl font-bold mb-2">Chat Not Found</h1>
      <p className="text-muted-foreground mb-6">
        The chat history you are looking for does not exist or was deleted.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Start New Chat
      </Link>
    </div>
  )
}
