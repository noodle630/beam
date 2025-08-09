import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Test basic connectivity
    const { data: orgs, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .limit(1)

    // Test if ingestion_jobs table exists
    const { data: jobs, error: jobError } = await supabase
      .from('ingestion_jobs')
      .select('*')
      .limit(1)

    // Test if field_mappings table exists  
    const { data: mappings, error: mappingError } = await supabase
      .from('field_mappings')
      .select('*')
      .limit(1)

    return NextResponse.json({
      supabase_connected: !orgError,
      organizations_table: {
        exists: !orgError,
        error: orgError?.message,
        count: orgs?.length || 0
      },
      ingestion_jobs_table: {
        exists: !jobError,
        error: jobError?.message,
        count: jobs?.length || 0
      },
      field_mappings_table: {
        exists: !mappingError,
        error: mappingError?.message,
        count: mappings?.length || 0
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      supabase_connected: false
    })
  }
} 