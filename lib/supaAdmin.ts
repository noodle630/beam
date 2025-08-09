// Load environment variables from .env file when not in Next.js context
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  try {
    require('dotenv/config')
  } catch (e) {
    // dotenv might not be available in some environments
    console.log('Note: dotenv not available, relying on system environment variables')
  }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables for Supabase admin client:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing')
  console.error('')
  console.error('📝 Please ensure these are set in your .env file.')
  console.error('💡 For compiled scripts, you may need to set system environment variables.')
  throw new Error('Missing required Supabase configuration for admin operations')
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export function debugLog(message: string, data?: any) {
  if (process.env.DEBUG_MCP) {
    console.log(`[MCP] ${message}`, data || '')
  }
} 