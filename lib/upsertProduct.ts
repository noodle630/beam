import { supabaseAdmin } from './supaAdmin'
import { NormalizedProduct } from '../types/mapping'
import { createHash } from 'crypto'

// Load environment variables from .env file when not in Next.js context
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  require('dotenv/config')
}

export interface UpsertResult {
  action: 'inserted' | 'updated' | 'unchanged'
  productId: string
  matchedOn?: string
}

export interface UpsertSummary {
  seen: number
  inserted: number
  updated: number
  unchanged: number
  errors: number
  error_details: Array<{ product_id: string; error: string }>
}

/**
 * Create a stable hash of product data for change detection
 */
function createProductHash(product: NormalizedProduct): string {
  // Create a stable representation of the product data
  const hashData = {
    title: product.title || null,
    brand: product.brand || null,
    category: product.category || null,
    price: product.price || null,
    currency: product.currency || null,
    quantity: product.quantity || null,
    sku: product.sku || null,
    image_urls: product.image_urls ? [...product.image_urls].sort() : null,
    attributes: product.attributes ? JSON.parse(JSON.stringify(product.attributes, Object.keys(product.attributes).sort())) : null
  }
  
  const dataString = JSON.stringify(hashData)
  return createHash('sha1').update(dataString).digest('hex')
}

/**
 * Upsert a normalized product into the products table with intelligent conflict resolution
 */
export async function upsertProduct(product: NormalizedProduct): Promise<UpsertResult> {
  // Calculate hash for change detection
  const currentHash = createProductHash(product)
  
  // Add hash to attributes
  const productWithHash = {
    ...product,
    attributes: {
      ...product.attributes,
      _sync_hash: currentHash
    },
    updated_at: new Date().toISOString()
  }

  // Define matching strategy based on source
  let matchConditions: any
  let conflictColumns: string[]

  if (product.source === 'shopify') {
    // For Shopify: match only on (org_slug, merchant_product_id)
    matchConditions = {
      org_slug: product.org_slug,
      merchant_product_id: product.merchant_product_id,
      source: 'shopify'
    }
    conflictColumns = ['org_slug', 'merchant_product_id']
  } else {
    // For non-Shopify: use original priority logic
    if (product.merchant_product_id && product.merchant_variant_id) {
      matchConditions = {
        org_slug: product.org_slug,
        merchant_product_id: product.merchant_product_id,
        merchant_variant_id: product.merchant_variant_id
      }
      conflictColumns = ['org_slug', 'merchant_product_id', 'merchant_variant_id']
    } else if (product.sku) {
      matchConditions = {
        org_slug: product.org_slug,
        sku: product.sku
      }
      conflictColumns = ['org_slug', 'sku']
    } else {
      // No matching criteria, insert new
      const { data, error } = await supabaseAdmin
        .from('products')
        .insert(productWithHash)
        .select('id')
        .single()

      if (error) {
        throw new Error(`Failed to insert product: ${error.message}`)
      }

      return {
        action: 'inserted',
        productId: data.id
      }
    }
  }

  // Try to find existing product
  const { data: existingProducts, error: selectError } = await supabaseAdmin
    .from('products')
    .select('id, attributes, updated_at')
    .match(matchConditions)

  if (selectError) {
    throw new Error(`Failed to query existing products: ${selectError.message}`)
  }

  if (existingProducts && existingProducts.length > 0) {
    // Found existing product(s)
    const existingProduct = existingProducts[0] // Take the first match
    
    // Check if data has changed by comparing hashes
    const existingHash = existingProduct.attributes?._sync_hash
    if (existingHash === currentHash) {
      // No changes detected
      return {
        action: 'unchanged',
        productId: existingProduct.id,
        matchedOn: conflictColumns.join('+')
      }
    }

    // Data has changed, perform update
    // Merge attributes (new attributes override existing ones)
    const mergedAttributes = {
      ...existingProduct.attributes,
      ...productWithHash.attributes
    }

    const updateData = {
      ...productWithHash,
      attributes: mergedAttributes
    }

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', existingProduct.id)
      .select('id')
      .single()

    if (updateError) {
      throw new Error(`Failed to update product: ${updateError.message}`)
    }

    return {
      action: 'updated',
      productId: updatedProduct.id,
      matchedOn: conflictColumns.join('+')
    }
  } else {
    // No existing product found, insert new
    // Ensure we have a title (use first attribute if title is missing)
    if (!productWithHash.title && productWithHash.attributes) {
      const firstAttrValue = Object.values(productWithHash.attributes)[0]
      if (typeof firstAttrValue === 'string') {
        productWithHash.title = firstAttrValue
      }
    }

    const { data: newProduct, error: insertError } = await supabaseAdmin
      .from('products')
      .insert(productWithHash)
      .select('id')
      .single()

    if (insertError) {
      throw new Error(`Failed to insert product: ${insertError.message}`)
    }

    return {
      action: 'inserted',
      productId: newProduct.id
    }
  }
}

/**
 * Batch upsert multiple products and return summary
 */
export async function batchUpsertProducts(products: NormalizedProduct[]): Promise<UpsertSummary> {
  const summary: UpsertSummary = {
    seen: products.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    error_details: []
  }

  for (const product of products) {
    try {
      const result = await upsertProduct(product)
      
      if (result.action === 'inserted') {
        summary.inserted++
        console.log(`✅ Inserted new product ${result.productId}`)
      } else if (result.action === 'updated') {
        summary.updated++
        console.log(`✅ Updated product ${result.productId} (matched on ${result.matchedOn})`)
      } else if (result.action === 'unchanged') {
        summary.unchanged++
        console.log(`⏹️  No changes for product ${result.productId} (matched on ${result.matchedOn})`)
      }
    } catch (error) {
      summary.errors++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const productId = product.merchant_product_id || product.sku || 'unknown'
      
      summary.error_details.push({
        product_id: productId,
        error: errorMessage
      })
      
      console.error('Error inserting product:', error)
      console.error(`❌ Failed to upsert product ${product.title || productId}: ${errorMessage}`)
    }
  }

  return summary
} 