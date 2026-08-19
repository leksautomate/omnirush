import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as relations from './relations'
import * as schema from './schema'

// For server-side usage only
// Use restricted user for application if available, otherwise fall back to regular user
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

// Connection with connection pooling for server environments
// Prefer restricted user for application runtime
const connectionString =
  process.env.DATABASE_RESTRICTED_URL ?? // Prefer restricted user
  process.env.DATABASE_URL ??
  'postgres://user:pass@localhost:5432/kakkao'


// Log which connection is being used (for debugging)
if (isDevelopment) {
  console.log(
    '[DB] Using connection:',
    process.env.DATABASE_RESTRICTED_URL
      ? 'Restricted User (RLS Active)'
      : 'Owner User (RLS Bypassed)'
  )
}

// SSL configuration: Use environment variable to control SSL
// DATABASE_SSL_DISABLED=true disables SSL completely (for local/Docker PostgreSQL)
// Default is to enable SSL with certificate verification (for cloud databases like Neon, Supabase)
const sslConfig =
  process.env.DATABASE_SSL_DISABLED === 'true'
    ? false // Disable SSL entirely for local PostgreSQL
    : process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true'
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false } // Default to false for cloud DB poolers (Supabase) to avoid SELF_SIGNED_CERT_IN_CHAIN error

const client = postgres(connectionString, {
  ssl: sslConfig,
  prepare: false,
  max: 20, // Max 20 connections
  // Neon (and similar serverless/scale-to-zero Postgres) silently kills idle connections
  // when its compute suspends, without telling this pool — the next query on that
  // connection then fails with ECONNRESET instead of transparently reconnecting.
  // Proactively closing connections before Neon does (idle_timeout) and periodically
  // cycling even active ones (max_lifetime) keeps the pool holding only fresh
  // connections, so a suspend/resume is far less likely to surface as a request error.
  idle_timeout: 20,
  max_lifetime: 60 * 30
})

export const db = drizzle(client, {
  schema: { ...schema, ...relations }
})

// Helper type for all tables
export type Schema = typeof schema

// Verify restricted user permissions on startup
if (process.env.DATABASE_RESTRICTED_URL && !isTest) {
  // Only run verification in server environments, not during build
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    ;(async () => {
      try {
        const result = await db.execute<{ current_user: string }>(
          sql`SELECT current_user`
        )
        const currentUser = result[0]?.current_user

        if (isDevelopment) {
          console.log('[DB] ✓ Connection verified as user:', currentUser)
        }

        // Verify it's the restricted user (app_user)
        if (
          currentUser &&
          !currentUser.includes('app_user') &&
          !currentUser.includes('neondb_owner')
        ) {
          console.warn(
            '[DB] ⚠️ Warning: Expected app_user but connected as:',
            currentUser
          )
        }
      } catch (error) {
        console.error('[DB] ✗ Failed to verify database connection:', error)
        // Log the error but don't terminate the application
        // This allows development to continue even with connection issues
      }
    })()
  }
}
