import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseCatalogCSV } from '@/lib/parseCatalog'
import { mapCsvRowToProduct, getDefaultMappingRules } from '@/lib/mapper'
import { batchUpsertProducts } from '@/lib/upsertProduct'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const orgSlug = formData.get('org_slug') as string

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!orgSlug) {
    return NextResponse.json({ error: 'org_slug is required' }, { status: 400 })
  }

  let jobId: string | null = null

  try {
    // Create ingestion job record
    const { data: job, error: jobError } = await supabase
      .from('ingestion_jobs')
      .insert({
        org_slug: orgSlug,
        source: 'csv',
        filename: file.name,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: {
          file_size: file.size,
          file_type: file.type
        }
      })
      .select()
      .single()

    if (jobError) {
      console.error('❌ Error creating ingestion job:', jobError)
      return NextResponse.json({ 
        error: 'Failed to create ingestion job',
        debug: jobError
      }, { status: 500 })
    }

    jobId = job.id
    console.log(`🚀 Started ingestion job ${jobId} for org ${orgSlug}`)

    const text = await file.text()
    
    // Parse CSV
    const rawRows = parseCatalogCSV(text)
    console.log(`✅ Parsed CSV: ${rawRows.length} rows`)

    // Initialize counters
    let rows_seen = rawRows.length
    let rows_processed = 0
    let mapping_errors: any[] = []
    
    // Get mapping rules (fallback to defaults if none exist)
    const defaultRules = getDefaultMappingRules()
    
    // Map CSV rows to normalized products
    const normalizedProducts = []
    
    for (let i = 0; i < rawRows.length; i++) {
      try {
        const normalizedProduct = await mapCsvRowToProduct(rawRows[i], orgSlug, defaultRules)
        normalizedProducts.push(normalizedProduct)
        rows_processed++
      } catch (error) {
        console.error(`Error mapping row ${i + 1}:`, error)
        mapping_errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown mapping error',
          data: rawRows[i]
        })
      }
    }

    // Upsert products
    const summary = await batchUpsertProducts(normalizedProducts)

    // Calculate final metrics
    const total_errors = mapping_errors.length + summary.errors
    const finalStatus = total_errors === 0 ? 'success' : 'error'

    // Prepare comprehensive metrics for storage
    const finalMetrics = {
      rows_seen: summary.seen,
      rows_processed: summary.seen,
      rows_inserted: summary.inserted,
      rows_updated: summary.updated,
      rows_upserted: summary.inserted + summary.updated,
      errors_count: total_errors,
      mapping_errors_count: mapping_errors.length,
      upsert_errors_count: summary.errors,
      total_errors,
      mapping_error_details: mapping_errors.slice(0, 5), // First 5 errors
      upsert_error_details: summary.error_details?.slice(0, 5),
      completed_at: new Date().toISOString()
    }

    // Update job with completion status and full metrics
    const { error: updateError } = await supabase
      .from('ingestion_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        errors_count: total_errors,
        metadata: finalMetrics
      })
      .eq('id', jobId)

    if (updateError) {
      console.error('Error updating job status:', updateError)
    }

    console.log(`✅ Ingestion job ${jobId} completed with status: ${finalStatus}`)
    console.log(`   Metrics: ${summary.inserted} inserted, ${summary.updated} updated, ${total_errors} errors`)

    // Return summary
    const response = NextResponse.json({
      success: true,
      message: `Successfully processed ${summary.seen} rows`,
      summary: {
        file_name: file.name,
        org_slug: orgSlug,
        rows_seen: summary.seen,
        rows_inserted: summary.inserted,
        rows_updated: summary.updated,
        total_errors,
        mapping_errors: mapping_errors.length,
        upsert_errors: summary.errors
      },
      errors: mapping_errors.length > 0 ? mapping_errors.slice(0, 10) : undefined,
      upsert_errors: summary.error_details?.slice(0, 10)
    })

  } catch (error) {
    console.error('❌ Ingestion failed:', error)
    
    // Try to update job status to failed if we have a job ID
    if (jobId) {
      try {
        await supabase
          .from('ingestion_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            errors_count: 1,
            metadata: {
              error: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : undefined,
              completed_at: new Date().toISOString()
            }
          })
          .eq('id', jobId)
      } catch (updateError) {
        console.error('Error updating job to failed status:', updateError)
      }
    }

    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Ingestion failed'
    }, { status: 500 })
  }
} 