// src/app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { parseCatalogCSV, ProductRow } from '@/lib/parseCatalog'
import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  try {
  const text = await file.text()
    console.log('📄 File content preview:', text.substring(0, 200) + '...')

    // Parse CSV with improved error handling
  const parsed = parseCatalogCSV(text)
    console.log('✅ Parsed products:', parsed.length, 'items')

    // Add org_slug to each row
    const productsWithOrg: ProductRow[] = parsed.map((product) => ({
      ...product,
      org_slug: 'demo-brand'
    }))

    console.log('📦 Products to insert:', productsWithOrg)

    // First, ensure the organization exists
    const { data: existingOrg, error: orgCheckError } = await supabase
      .from('organizations')
      .select('slug')
      .eq('slug', 'demo-brand')
      .single()

    if (orgCheckError && orgCheckError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error checking organization:', orgCheckError)
      return NextResponse.json({ 
        error: 'Database error: ' + orgCheckError.message 
      }, { status: 500 })
    }

    // Create organization if it doesn't exist
    if (!existingOrg) {
      console.log('🏢 Creating organization: demo-brand')
      const { error: createOrgError } = await supabase
        .from('organizations')
        .insert({
          slug: 'demo-brand',
          name: 'Demo Brand'
        })

      if (createOrgError) {
        console.error('❌ Error creating organization:', createOrgError)
        return NextResponse.json({ 
          error: 'Database error: ' + createOrgError.message 
        }, { status: 500 })
      }
    }

    // Insert products into Supabase
    const { data, error } = await supabase
      .from('products')
      .insert(productsWithOrg)
      .select()

    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json({ 
        error: 'Database error: ' + error.message 
      }, { status: 500 })
    }

    console.log('✅ Successfully inserted products:', data?.length || 0)

    return NextResponse.json({ 
      success: true, 
      message: `Successfully uploaded ${data?.length || 0} products`,
      products: data 
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }, { status: 500 })
  }
}
