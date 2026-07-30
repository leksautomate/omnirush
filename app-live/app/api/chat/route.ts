import { revalidateTag } from 'next/cache'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

import { loadChat } from '@/lib/actions/chat'
import {
  calculateConversationTurn,
  deriveQueryShape,
  getServerFeatureFlag,
  trackChatEvent
} from '@/lib/analytics'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { generateId } from '@/lib/db/schema'
import { checkAndEnforceAdaptiveLimit } from '@/lib/rate-limit/adaptive-limit'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { createChatStreamResponse } from '@/lib/streaming/create-chat-stream-response'
import { SearchMode } from '@/lib/types/search'
import { getTextFromParts } from '@/lib/utils/message-utils'
import { selectModel } from '@/lib/utils/model-selection'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'
import { resetAllCounters } from '@/lib/utils/perf-tracking'
import { isProviderEnabled } from '@/lib/utils/registry'

export const maxDuration = 300

export async function POST(req: Request) {
  const startTime = performance.now()
  const abortSignal = req.signal

  // Reset counters for new request (development only)
  if (process.env.ENABLE_PERF_LOGGING === 'true') {
    resetAllCounters()
  }

  try {
    const body = await req.json()
    const { message, messages, chatId, trigger, messageId, isNewChat } = body
    const analyticsId: unknown = body.analyticsId

    // Normalize the message id up front so persistence and analytics agree on it.
    if (message && !message.id) {
      message.id = generateId()
    }

    perfLog(
      `API Route - Start: chatId=${chatId}, trigger=${trigger}, isNewChat=${isNewChat}`
    )

    // Handle different triggers using AI SDK standard values
    if (trigger === 'regenerate-message') {
      if (!messageId) {
        return new Response('messageId is required for regeneration', {
          status: 400,
          statusText: 'Bad Request'
        })
      }
    } else if (trigger === 'submit-message') {
      if (!message) {
        return new Response('message is required for submission', {
          status: 400,
          statusText: 'Bad Request'
        })
      }
    }

    const referer = req.headers.get('referer')
    const isSharePage = referer?.includes('/share/')

    const authStart = performance.now()
    const userId = await getCurrentUserId()
    perfTime('Auth completed', authStart)

    if (isSharePage) {
      return new Response('Chat API is not available on share pages', {
        status: 403,
        statusText: 'Forbidden'
      })
    }

    // Authentication is required for every chat request. There is no guest path.
    if (!userId) {
      return new Response('Authentication required', {
        status: 401,
        statusText: 'Unauthorized'
      })
    }

    const cookieStore = await cookies()

    // Get search mode from cookie
    const searchModeCookie = cookieStore.get('searchMode')?.value
    const searchMode: SearchMode =
      searchModeCookie && ['quick', 'adaptive'].includes(searchModeCookie)
        ? (searchModeCookie as SearchMode)
        : 'quick'

    // Adaptive mode is available to every signed-in user.

    const selectedModel = await selectModel({ searchMode, cookieStore })

    if (!selectedModel) {
      return new Response('No enabled model is available', {
        status: 503,
        statusText: 'Service Unavailable'
      })
    }

    if (!isProviderEnabled(selectedModel.providerId)) {
      return new Response(
        `Selected provider is not enabled ${selectedModel.providerId}`,
        {
          status: 404,
          statusText: 'Not Found'
        }
      )
    }

    const overallLimitResponse = await checkAndEnforceOverallChatLimit(userId)
    if (overallLimitResponse) return overallLimitResponse

    if (searchMode === 'adaptive') {
      const adaptiveLimitResponse = await checkAndEnforceAdaptiveLimit(userId)
      if (adaptiveLimitResponse) return adaptiveLimitResponse
    }

    // Distinct id used for BOTH flag evaluation and analytics attribution, so
    // the stamped relatedFlag matches the arm the user was actually bucketed to.
    void analyticsId
    const analyticsDistinctId = userId

    // related_questions_enabled flag. Prefer the client-evaluated value (no
    // round-trip); fall back to server evaluation against the same distinct id
    // when the client couldn't resolve flags in time (cold-start / auto-submit),
    // so first-message sessions aren't misattributed to the on arm. On by default.
    const clientRelated = body.relatedEnabled
    const relatedEnabled =
      typeof clientRelated === 'boolean'
        ? clientRelated
        : ((analyticsDistinctId
            ? await getServerFeatureFlag(
                'related_questions_enabled',
                analyticsDistinctId
              )
            : undefined) ?? true)

    const streamStart = performance.now()
    perfLog(
      `createChatStreamResponse - Start: model=${selectedModel.providerId}:${selectedModel.id}, searchMode=${searchMode}`
    )

    const response = await createChatStreamResponse({
      message,
      model: selectedModel,
      chatId,
      userId,
      trigger,
      messageId,
      abortSignal,
      isNewChat,
      searchMode,
      relatedEnabled
    })

    perfTime('createChatStreamResponse resolved', streamStart)

    // Track analytics event (non-blocking)
    // Calculate conversation turn by loading chat history
    ;(async () => {
      try {
        // Attribute to the authenticated user id, or the client-provided
        // PostHog distinct id for guests (so it merges with their client events).
        const distinctId = analyticsDistinctId
        if (!distinctId) return

        let conversationTurn = 1 // Default for new chats
        if (!isNewChat) {
          const chat = await loadChat(chatId, userId)
          if (chat?.messages) {
            conversationTurn = calculateConversationTurn(
              chat.messages,
              message?.id
            )
          }
        }

        const resolvedTrigger =
          (trigger as 'submit-message' | 'regenerate-message') ??
          'submit-message'
        const queryShape =
          resolvedTrigger === 'submit-message' && message?.parts
            ? deriveQueryShape(getTextFromParts(message.parts))
            : undefined

        await trackChatEvent({
          searchMode,
          conversationTurn,
          isNewChat: isNewChat ?? false,
          trigger: resolvedTrigger,
          chatId,
          distinctId,
          isGuest: false,
          userId,
          providerId: selectedModel.providerId,
          modelId: selectedModel.id,
          relatedFlag: relatedEnabled,
          queryShape
        })
      } catch (error) {
        // Log error but don't throw - analytics should never break the app
        console.error('Analytics tracking failed:', error)
      }
    })()

    // Invalidate the cache for this specific chat after creating the response
    // This ensures the next load will get fresh data
    if (chatId) {
      revalidateTag(`chat-${chatId}`, 'max')
    }

    const totalTime = performance.now() - startTime
    perfLog(`Total API route time: ${totalTime.toFixed(2)}ms`)
    perfLog(`=== Summary ===`)
    perfLog(`Chat Type: ${isNewChat ? 'NEW' : 'EXISTING'}`)
    perfLog(`Total Time: ${totalTime.toFixed(2)}ms`)
    perfLog(`================`)

    return response
  } catch (error) {
    console.error('API route error:', error)
    return new Response('Error processing your request', {
      status: 500,
      statusText: 'Internal Server Error'
    })
  }
}
