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

  const user = await getCurrentUser()
  return user?.id
}
