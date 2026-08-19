import Link from 'next/link'

export default function StudioNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      <h1 className="text-4xl font-bold mb-2">Studio Link Expired</h1>
      <p className="text-muted-foreground mb-6">
        This storyboard is no longer in storage — either it expired or the server
        restarted before it was saved. Go back to the chat that made it and ask to
        re-run composeRender for a fresh link.
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
