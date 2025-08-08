import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return NextResponse.json({
    environment: process.env.NODE_ENV,
    supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
    supabaseAnonKey: supabaseAnonKey ? '✅ Set' : '❌ Missing',
    supabaseUrlLength: supabaseUrl?.length || 0,
    supabaseAnonKeyLength: supabaseAnonKey?.length || 0,
    allEnvVars: Object.keys(process.env).filter(key => key.includes('SUPABASE'))
  })
} 