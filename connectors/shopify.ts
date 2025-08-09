import { supabaseAdmin } from '../lib/supaAdmin'
import { upsertProduct, batchUpsertProducts } from '../lib/upsertProduct'
import { NormalizedProduct } from '../types/mapping'

// Load environment variables from .env file when not in Next.js context
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  require('dotenv/config')
}

export interface ShopifyConnectorConfig {
  shopDomain: string
  adminToken: string
  apiVersion: string
}

export interface ShopifyProduct {
  id: string
  title: string
  vendor: string
  productType: string
  handle: string
  tags: string[]
  status: string
  bodyHtml: string
  images: {
    nodes: Array<{ url: string }>
  }
  variants: {
    nodes: Array<{
      id: string
      title: string
      sku: string
      price: string
      availableForSale: boolean
      inventoryQuantity: number | null
      selectedOptions: Array<{ name: string; value: string }>
    }>
  }
}

interface ShopMeta {
  currency: string
}

export interface SyncSummary {
  org_slug: string
  seen: number
  inserted: number
  updated: number
  unchanged: number
  errors: number
  error_details?: Array<{ product_id: string; error: string }>
}

/**
 * Convert shop domain to org slug
 * Example: "beam-devtest.myshopify.com" → "beam-devtest"
 */
export function getOrgSlugFromDomain(shopDomain: string): string {
  return shopDomain.replace('.myshopify.com', '')
}

/**
 * Ensure organization exists for the given org slug
 */
async function ensureOrganizationExists(orgSlug: string, shopDomain: string): Promise<void> {
  // Check if organization exists
  const { data: existingOrg } = await supabaseAdmin
    .from('organizations')
    .select('slug')
    .eq('slug', orgSlug)
    .single()

  if (!existingOrg) {
    // Create organization
    const { error } = await supabaseAdmin
      .from('organizations')
      .insert({
        slug: orgSlug,
        name: `${orgSlug} (Shopify Store)`,
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error(`❌ Failed to create organization ${orgSlug}:`, error)
      throw new Error(`Failed to create organization: ${error.message}`)
    }

    console.log(`✅ Created organization: ${orgSlug}`)
  }
}

/**
 * Execute GraphQL query against Shopify Admin API
 */
async function shopifyGraphQL<T = any>(
  config: ShopifyConnectorConfig,
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': config.adminToken
    },
    body: JSON.stringify({
      query,
      variables
    })
  })

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
  }

  const result = await response.json()

  if (result.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
  }

  return result.data
}

/**
 * Get shop metadata including currency
 */
async function getShopMeta(config: ShopifyConnectorConfig): Promise<ShopMeta> {
  const query = `
    query ShopMeta {
      shop {
        currencyCode
      }
    }
  `

  return shopifyGraphQL<ShopMeta>(config, query)
}

/**
 * Fetch all products with pagination
 */
async function* fetchAllProducts(config: ShopifyConnectorConfig): AsyncGenerator<ShopifyProduct[]> {
  const query = `
    query Products($cursor: String) {
      products(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          vendor
          productType
          handle
          tags
          status
          bodyHtml
          images(first: 50) {
            nodes {
              url: originalSrc
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              price
              availableForSale
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `

  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const variables: Record<string, any> = cursor ? { cursor } : {}
    const result: {
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string }
        nodes: ShopifyProduct[]
      }
    } = await shopifyGraphQL(config, query, variables)

    yield result.products.nodes
    
    hasNextPage = result.products.pageInfo.hasNextPage
    cursor = result.products.pageInfo.endCursor

    // Rate limiting: small delay between requests
    if (hasNextPage) {
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
}

/**
 * Normalize Shopify product to our schema
 */
function normalizeShopifyProduct(
  product: ShopifyProduct,
  orgSlug: string,
  shopDomain: string,
  shopCurrency: string
): NormalizedProduct {
  // Calculate total quantity across variants
  const totalQuantity = product.variants.nodes.reduce((sum, variant) => {
    return sum + (variant.inventoryQuantity || 0)
  }, 0)

  // Extract image URLs
  const imageUrls = product.images.nodes.map(img => img.url)

  // Get first variant for primary product data
  const firstVariant = product.variants.nodes[0]
  
  // Determine if single variant product
  const isSingleVariant = product.variants.nodes.length === 1

  // Normalize variants for attributes
  const variants = product.variants.nodes.map(variant => ({
    id: variant.id,
    sku: variant.sku || '',
    title: variant.title,
    price: Number(variant.price) || 0,
    available: variant.availableForSale,
    quantity: variant.inventoryQuantity ?? null,
    options: Object.fromEntries(
      variant.selectedOptions.map(option => [
        option.name.toLowerCase(),
        option.value
      ])
    )
  }))

  const normalized: NormalizedProduct = {
    org_slug: orgSlug,
    title: product.title,
    brand: product.vendor || undefined,
    category: product.productType || undefined,
    price: firstVariant ? Number(firstVariant.price) || undefined : undefined,
    currency: shopCurrency,
    quantity: totalQuantity > 0 ? totalQuantity : undefined,
    image_urls: imageUrls.length > 0 ? imageUrls : undefined,
    sku: isSingleVariant ? firstVariant?.sku || undefined : undefined,
    merchant_product_id: product.id,
    merchant_variant_id: isSingleVariant ? firstVariant?.id : undefined,
    attributes: {
      description_html: product.bodyHtml || '',
      handle: product.handle,
      shop_domain: shopDomain,
      variants,
      pdp_url: `https://${shopDomain}/products/${product.handle}`,
      tags: product.tags,
      status: product.status,
      vendor: product.vendor
    },
    source: 'shopify',
    source_updated_at: new Date().toISOString()
  }

  return normalized
}

/**
 * Main sync function: pull products from Shopify and upsert to our database
 */
export async function syncShopifyCatalog(config: ShopifyConnectorConfig): Promise<SyncSummary> {
  console.log(`🚀 Starting Shopify sync for ${config.shopDomain}`)
  
  const orgSlug = getOrgSlugFromDomain(config.shopDomain)
  
  // Ensure organization exists
  await ensureOrganizationExists(orgSlug, config.shopDomain)
  
  // Get shop metadata
  const shopMeta = await getShopMeta(config)
  console.log(`💰 Shop currency: ${shopMeta.currency}`)
  console.log(`🏢 Organization: ${orgSlug}`)
  
  // Initialize summary
  const summary: SyncSummary = {
    org_slug: orgSlug,
    seen: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    error_details: []
  }
  
  // Process products in batches
  for await (const productBatch of fetchAllProducts(config)) {
    console.log(`📦 Processing batch of ${productBatch.length} products...`)
    
    // Convert each Shopify product to normalized format
    const normalizedProducts: NormalizedProduct[] = productBatch.map(product => 
      normalizeShopifyProduct(product, orgSlug, config.shopDomain, shopMeta.currency)
    )
    
    // Batch upsert the products
    const batchSummary = await batchUpsertProducts(normalizedProducts)
    
    // Aggregate summaries
    summary.seen += batchSummary.seen
    summary.inserted += batchSummary.inserted
    summary.updated += batchSummary.updated
    summary.unchanged += batchSummary.unchanged
    summary.errors += batchSummary.errors
    if (summary.error_details) {
      summary.error_details.push(...batchSummary.error_details)
    } else {
      summary.error_details = [...batchSummary.error_details]
    }
    
    // Log progress
    console.log(`📊 Progress: ${summary.seen} seen, ${summary.inserted} inserted, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.errors} errors`)
  }
  
  console.log('✅ Shopify sync completed')
  console.log(`📈 Summary: ${summary.seen} products processed`)
  console.log(`   📥 ${summary.inserted} inserted`)
  console.log(`   🔄 ${summary.updated} updated`)
  console.log(`   ⏹️  ${summary.unchanged} unchanged`)
  console.log(`   ❌ ${summary.errors} errors`)
  
  return summary
}

/**
 * Create Shopify checkout link for specific variant
 */
export function createShopifyCheckoutLink(params: {
  shopDomain: string
  variantId: string
  qty?: number
}): string {
  const { shopDomain, variantId, qty = 1 } = params
  return `https://${shopDomain}/cart/${variantId}:${qty}`
} 