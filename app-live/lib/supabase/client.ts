import { createBrowserClient } from '@supabase/ssr'

import { getSupabasePublishableKey, getSupabaseUrl } from './keys'

let warnedOnce = false

export function createClient() {
  const url = getSupabaseUrl()
  const key = getSupabasePublishableKey()

  if (!url || !key) {
    if (!warnedOnce) {
      warnedOnce = true
      console.warn(
        'Supabase client configuration missing. Authentication features will be unavailable. ' +
          'To enable authentication, set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY at build time.'
      )
    }
    return createBrowserClient(
      url || 'https://placeholder.supabase.co',
      key || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder'
    )
  }

  return createBrowserClient(url, key)
}
