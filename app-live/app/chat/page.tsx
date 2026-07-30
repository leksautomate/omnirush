import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { getModelSelectorData } from '@/lib/model-selector/get-model-selector-data'
import { generateUUID } from '@/lib/utils'

import { Chat } from '@/components/chat'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export default async function ChatQueryPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = generateUUID()
  const userId = await getCurrentUserId()

  if (!userId) {
    redirect('/auth/login')
  }

  const isCloudDeployment = process.env.KAKKAO_CLOUD_DEPLOYMENT === 'true'
  const modelSelectorData = await getModelSelectorData()

  return (
    <Chat
      id={id}
      query={q}
      isCloudDeployment={isCloudDeployment}
      libraryAvailable
      modelSelectorData={modelSelectorData}
    />
  )
}
