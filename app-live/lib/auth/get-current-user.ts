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
  return data.user ?? null
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
