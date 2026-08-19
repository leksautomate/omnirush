import { notFound, redirect } from 'next/navigation'

import { UIMessage } from 'ai'

import { loadChat } from '@/lib/actions/chat'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'

import { Chat } from '@/components/chat'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  const chat = await loadChat(id, userId)

  if (!chat || !chat.title) {
    return { title: 'Chat' }
  }

  return {
    title: typeof chat.title === 'string' ? chat.title.slice(0, 50) : 'Chat'
  }
}

export default async function ChatPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params
  const userId = await getCurrentUserId()

  if (!userId) {
    redirect('/auth/login')
  }

  const chat = await loadChat(id, userId)

  const messages: UIMessage[] = chat?.messages ?? []
  const isCloudDeployment = process.env.KAKKAO_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      id={id}
      savedMessages={messages}
      isCloudDeployment={isCloudDeployment}
      libraryAvailable
      modelSelectorData={modelSelectorData}
    />
  )
}
