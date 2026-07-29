import { hasSupabasePublicConfig } from '@/lib/supabase/keys'
import { createClient } from '@/lib/supabase/server'
import { perfLog } from '@/lib/utils/perf-logging'
import { incrementAuthCallCount } from '@/lib/utils/perf-tracking'

export async function getCurrentUser() {
  if (!hasSupabasePublicConfig()) {
    return null // Supabase is not configured
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (data.user) {
    return data.user
  }

  try {
    const { headers } = await import('next/headers')
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const { data: bearerData } = await supabase.auth.getUser(token)
      if (bearerData.user) {
        return bearerData.user
      }
    }
  } catch {
    // Ignore header inspection errors outside request context
  }

  return null
}

export async function getCurrentUserId() {
  const count = incrementAuthCallCount()
  perfLog(`getCurrentUserId called - count: ${count}`)

  // Skip authentication mode ONLY if explicitly disabled (e.g. local single-user Docker)
  if (process.env.ENABLE_AUTH === 'false' && process.env.KAKKAO_CLOUD_DEPLOYMENT !== 'true') {
    return process.env.ANONYMOUS_USER_ID || 'anonymous-user'
  }

  const user = await getCurrentUser()
  if (user?.id) {
    return user.id
  }

  return undefined
}
