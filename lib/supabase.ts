import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing')
  console.error('')
  console.error('📝 Please create a .env.local file with:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url')
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key')
  console.error('')
  console.error('🔗 Get these from: https://supabase.com/dashboard/project/[your-project]/settings/api')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder_key'
) 