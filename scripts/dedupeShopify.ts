#!/usr/bin/env ts-node

// Load environment variables from .env file
import 'dotenv/config'

import { supabaseAdmin } from '../lib/supaAdmin'

interface DuplicateGroup {
  org_slug: string
  merchant_product_id: string
  duplicate_count: number
}

interface ProductRow {
  id: string
  org_slug: string
  title: string | null
  brand: string | null
  category: string | null
  price: number | null
  currency: string | null
  quantity: number | null
  sku: string | null
  image_urls: string[] | null
  merchant_product_id: string | null
  merchant_variant_id: string | null
  attributes: Record<string, any> | null
  source: string | null
  source_updated_at: string | null
  updated_at: string | null
  created_at: string | null
}

async function findDuplicateGroups(): Promise<DuplicateGroup[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('org_slug, merchant_product_id')
    .eq('source', 'shopify')

  if (error) {
    throw new Error(`Failed to query products: ${error.message}`)
  }

  // Group by (org_slug, merchant_product_id) and count
  const groups = new Map<string, number>()
  for (const row of data) {
    const key = `${row.org_slug}:${row.merchant_product_id}`
    groups.set(key, (groups.get(key) || 0) + 1)
  }

  // Return only groups with duplicates
  const duplicates: DuplicateGroup[] = []
  for (const [key, count] of groups.entries()) {
    if (count > 1) {
      const [org_slug, merchant_product_id] = key.split(':')
      duplicates.push({ org_slug, merchant_product_id, duplicate_count: count })
    }
  }

  return duplicates.sort((a, b) => b.duplicate_count - a.duplicate_count)
}

async function getProductsInGroup(org_slug: string, merchant_product_id: string): Promise<ProductRow[]> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('org_slug', org_slug)
    .eq('merchant_product_id', merchant_product_id)
    .eq('source', 'shopify')
    .order('updated_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to query products for group: ${error.message}`)
  }

  return data as ProductRow[]
}

function mergeProducts(products: ProductRow[]): ProductRow {
  if (products.length === 0) {
    throw new Error('Cannot merge empty product list')
  }

  // Start with the newest product as the base (first in the ordered list)
  const survivor = { ...products[0] }

  // Merge data from other products
  const allImageUrls = new Set<string>()
  const allVariants = new Map<string, any>()

  for (const product of products) {
    // Union image_urls
    if (product.image_urls && Array.isArray(product.image_urls)) {
      for (const url of product.image_urls) {
        if (url && typeof url === 'string') {
          allImageUrls.add(url)
        }
      }
    }

    // Union variants by ID
    if (product.attributes?.variants && Array.isArray(product.attributes.variants)) {
      for (const variant of product.attributes.variants) {
        if (variant?.id) {
          allVariants.set(variant.id, variant)
        }
      }
    }

    // Merge attributes (survivor takes precedence for conflicting keys)
    if (product.attributes && typeof product.attributes === 'object') {
      survivor.attributes = {
        ...product.attributes,
        ...survivor.attributes, // Survivor attributes override
      }
    }
  }

  // Set merged data
  survivor.image_urls = Array.from(allImageUrls).sort()
  if (survivor.attributes) {
    survivor.attributes.variants = Array.from(allVariants.values())
  }

  return survivor
}

async function dedupeGroup(group: DuplicateGroup): Promise<void> {
  console.log(`🔄 Processing group: ${group.org_slug}:${group.merchant_product_id} (${group.duplicate_count} duplicates)`)

  // Get all products in this group
  const products = await getProductsInGroup(group.org_slug, group.merchant_product_id)
  
  if (products.length <= 1) {
    console.log(`   ✅ No action needed (${products.length} products found)`)
    return
  }

  // Merge all products into the survivor (newest one)
  const mergedProduct = mergeProducts(products)
  const survivorId = mergedProduct.id
  const loserIds = products.slice(1).map(p => p.id)

  console.log(`   🎯 Survivor: ${survivorId}`)
  console.log(`   🗑️  Will delete: ${loserIds.join(', ')}`)

  // Update the survivor with merged data
  const updateData = {
    title: mergedProduct.title,
    brand: mergedProduct.brand,
    category: mergedProduct.category,
    price: mergedProduct.price,
    currency: mergedProduct.currency,
    quantity: mergedProduct.quantity,
    sku: mergedProduct.sku,
    image_urls: mergedProduct.image_urls,
    attributes: mergedProduct.attributes,
    updated_at: new Date().toISOString()
  }

  const { error: updateError } = await supabaseAdmin
    .from('products')
    .update(updateData)
    .eq('id', survivorId)

  if (updateError) {
    throw new Error(`Failed to update survivor ${survivorId}: ${updateError.message}`)
  }

  // Delete the losing products
  const { error: deleteError } = await supabaseAdmin
    .from('products')
    .delete()
    .in('id', loserIds)

  if (deleteError) {
    throw new Error(`Failed to delete losers: ${deleteError.message}`)
  }

  console.log(`   ✅ Merged ${products.length} → 1, deleted ${loserIds.length} duplicates`)
}

async function main() {
  console.log('🚀 Beam Shopify Deduplication Tool')
  console.log('==================================')

  try {
    // Find all duplicate groups
    console.log('🔍 Scanning for duplicate Shopify products...')
    const duplicateGroups = await findDuplicateGroups()

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicates found! Your database is clean.')
      return
    }

    console.log(`⚠️  Found ${duplicateGroups.length} groups with duplicates:`)
    for (const group of duplicateGroups) {
      console.log(`   ${group.org_slug}:${group.merchant_product_id} → ${group.duplicate_count} copies`)
    }
    console.log('')

    // Process each group
    let totalDuplicatesRemoved = 0
    for (const group of duplicateGroups) {
      await dedupeGroup(group)
      totalDuplicatesRemoved += group.duplicate_count - 1
    }

    console.log('')
    console.log('🎉 Deduplication completed!')
    console.log(`📊 Summary:`)
    console.log(`   🔍 Groups processed: ${duplicateGroups.length}`)
    console.log(`   🗑️  Duplicates removed: ${totalDuplicatesRemoved}`)
    console.log('')
    console.log('✅ Your database is now clean and ready for proper syncing!')

  } catch (error) {
    console.error('')
    console.error('❌ Deduplication failed:')
    if (error instanceof Error) {
      console.error(`   ${error.message}`)
    } else {
      console.error('   Unknown error occurred')
    }
    
    console.error('')
    console.error('🔧 Troubleshooting:')
    console.error('   1. Ensure your Supabase service role key is correct')
    console.error('   2. Check that the products table exists and has the right structure')
    console.error('   3. Make sure you have the necessary permissions')
    
    process.exit(1)
  }
}

// Run the script if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Unexpected error:', error)
    process.exit(1)
  })
} 