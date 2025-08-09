// Load environment variables from .env file when not in Next.js context
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
  require('dotenv/config')
}

import { supabaseAdmin, debugLog } from './supaAdmin'
import { getOrgSlugFromDomain, createShopifyCheckoutLink } from '../connectors/shopify'

// Types for MCP actions
export interface FindProductsParams {
  org_slug?: string
  shop_domain?: string
  query?: string
  brand?: string | string[]
  category?: string | string[]
  condition?: string | string[]
  price_min?: number
  price_max?: number
  attributes?: Record<string, any>
  limit?: number
}

export interface ProductCard {
  product_id: string
  title: string
  brand?: string
  category?: string
  price?: number
  currency?: string
  image?: string | null
  url?: string | null
}

export interface ProductDetails {
  product_id: string
  title: string
  brand?: string
  category?: string
  price?: number
  currency?: string
  quantity?: number
  image_urls?: string[]
  sku?: string
  attributes?: Record<string, any>
  source?: string
}

export interface CheckoutLinkResponse {
  checkout_url: string | null
}

// Input validation
export function validateOrgIdentifier(params: any): string {
  if (params.org_slug && params.shop_domain) {
    throw new Error('Provide either org_slug or shop_domain, not both')
  }
  if (params.org_slug) {
    if (typeof params.org_slug !== 'string' || params.org_slug.trim().length === 0) {
      throw new Error('org_slug must be a non-empty string')
    }
    return params.org_slug.trim()
  }
  if (params.shop_domain) {
    if (typeof params.shop_domain !== 'string' || params.shop_domain.trim().length === 0) {
      throw new Error('shop_domain must be a non-empty string')
    }
    return getOrgSlugFromDomain(params.shop_domain.trim())
  }
  throw new Error('Either org_slug or shop_domain is required')
}

export function validateProductId(productId: any): string {
  if (typeof productId !== 'string' || productId.trim().length === 0) {
    throw new Error('product_id must be a non-empty string')
  }
  return productId.trim()
}

export function validateFindProductsParams(params: any): FindProductsParams & { org_slug: string } {
  const orgSlug = validateOrgIdentifier(params)
  
  const validated: FindProductsParams & { org_slug: string } = {
    org_slug: orgSlug
  }

  if (params.query !== undefined) {
    if (typeof params.query !== 'string') {
      throw new Error('query must be a string')
    }
    validated.query = params.query
  }

  if (params.brand !== undefined) {
    if (typeof params.brand === 'string') {
      // Handle comma-separated values
      if (params.brand.includes(',')) {
        validated.brand = params.brand.split(',').map((b: string) => b.trim()).filter((b: string) => b.length > 0)
      } else {
        validated.brand = params.brand
      }
    } else if (Array.isArray(params.brand)) {
      validated.brand = params.brand
    } else {
      throw new Error('brand must be a string or array of strings')
    }
  }

  if (params.category !== undefined) {
    if (typeof params.category === 'string') {
      // Handle comma-separated values
      if (params.category.includes(',')) {
        validated.category = params.category.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
      } else {
        validated.category = params.category
      }
    } else if (Array.isArray(params.category)) {
      validated.category = params.category
    } else {
      throw new Error('category must be a string or array of strings')
    }
  }

  if (params.condition !== undefined) {
    if (typeof params.condition === 'string') {
      // Handle comma-separated values
      if (params.condition.includes(',')) {
        validated.condition = params.condition.split(',').map((c: string) => c.trim()).filter((c: string) => c.length > 0)
      } else {
        validated.condition = params.condition
      }
    } else if (Array.isArray(params.condition)) {
      validated.condition = params.condition
    } else {
      throw new Error('condition must be a string or array of strings')
    }
  }

  if (params.price_min !== undefined) {
    const priceMin = Number(params.price_min)
    if (isNaN(priceMin) || priceMin < 0) {
      throw new Error('price_min must be a non-negative number')
    }
    validated.price_min = priceMin
  }

  if (params.price_max !== undefined) {
    const priceMax = Number(params.price_max)
    if (isNaN(priceMax) || priceMax < 0) {
      throw new Error('price_max must be a non-negative number')
    }
    validated.price_max = priceMax
  }

  if (params.attributes !== undefined) {
    if (typeof params.attributes !== 'object' || params.attributes === null) {
      throw new Error('attributes must be an object')
    }
    validated.attributes = params.attributes
  }

  if (params.limit !== undefined) {
    const limit = Number(params.limit)
    if (isNaN(limit) || limit < 1 || limit > 100) {
      throw new Error('limit must be a number between 1 and 100')
    }
    validated.limit = limit
  } else {
    validated.limit = 20
  }

  return validated
}

// MCP Action implementations
export async function findProducts(params: FindProductsParams): Promise<ProductCard[]> {
  debugLog('Finding products with params:', params)

  const orgSlug = validateOrgIdentifier(params)

  // Build the query
  let query = supabaseAdmin
    .from('products')
    .select('id, title, brand, category, price, currency, image_urls, sku, source, merchant_product_id, updated_at')
    .eq('org_slug', orgSlug)

  // Apply filters
  if (params.query) {
    query = query.or(`title.ilike.%${params.query}%, brand.ilike.%${params.query}%, category.ilike.%${params.query}%`)
  }

  if (params.brand) {
    const brands = Array.isArray(params.brand) ? params.brand : [params.brand]
    query = query.in('brand', brands)
  }

  if (params.category) {
    const categories = Array.isArray(params.category) ? params.category : [params.category]
    query = query.in('category', categories)
  }

  if (params.condition) {
    const conditions = Array.isArray(params.condition) ? params.condition : [params.condition]
    query = query.in('condition', conditions)
  }

  if (params.price_min !== undefined) {
    query = query.gte('price', params.price_min)
  }

  if (params.price_max !== undefined) {
    query = query.lte('price', params.price_max)
  }

  // Apply attributes filter
  if (params.attributes) {
    for (const [key, value] of Object.entries(params.attributes)) {
      query = query.contains('attributes', { [key]: value })
    }
  }

  // Apply limit
  if (params.limit) {
    query = query.limit(params.limit)
  }

  // Order by updated_at desc for consistent deduplication
  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }

  if (!data) {
    return []
  }

  // Deduplicate Shopify products by merchant_product_id (latest first)
  const deduplicatedData = data.reduce((acc, product) => {
    if (product.source === 'shopify' && product.merchant_product_id) {
      // Check if we already have this merchant_product_id
      const existing = acc.find(p => 
        p.source === 'shopify' && 
        p.merchant_product_id === product.merchant_product_id
      )
      
      if (!existing) {
        // First occurrence, add it
        acc.push(product)
      }
      // Skip duplicates (we keep the first one which is the latest due to ordering)
    } else {
      // Non-Shopify products, add as-is
      acc.push(product)
    }
    return acc
  }, [] as typeof data)

  // Convert to ProductCard format
  const results: ProductCard[] = deduplicatedData.map(product => ({
    product_id: product.id,
    title: product.title || 'Untitled Product',
    brand: product.brand || undefined,
    category: product.category || undefined,
    price: product.price || undefined,
    currency: product.currency || undefined,
    image: Array.isArray(product.image_urls) && product.image_urls.length > 0 
      ? product.image_urls[0] 
      : null,
    url: null
  }))

  debugLog('Found products:', results.length)
  return results
}

export async function getProductDetails(
  productId: string,
  orgSlug: string
): Promise<ProductDetails> {
  debugLog('Getting product details:', { productId, orgSlug })

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('org_slug', orgSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Product not found')
    }
    throw new Error(`Database query failed: ${error.message}`)
  }

  debugLog('Product details retrieved')
  
  return {
    product_id: data.id,
    title: data.title || 'Untitled Product',
    brand: data.brand || undefined,
    category: data.category || undefined,
    price: data.price || undefined,
    currency: data.currency || undefined,
    quantity: data.quantity || undefined,
    image_urls: data.image_urls || undefined,
    sku: data.sku || undefined,
    attributes: data.attributes || undefined,
    source: data.source || undefined
  }
}

export async function createCheckoutLink(
  productId: string,
  orgSlug: string,
  variant?: string,
  qty: number = 1,
  shopDomain?: string
): Promise<CheckoutLinkResponse> {
  debugLog('Creating checkout link:', { productId, orgSlug, variant, qty, shopDomain })

  const { data, error } = await supabaseAdmin
    .from('products')
    .select('source, attributes')
    .eq('id', productId)
    .eq('org_slug', orgSlug)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Product not found')
    }
    throw new Error(`Database query failed: ${error.message}`)
  }

  if (data.source === 'shopify') {
    let effectiveShopDomain = shopDomain
    if (!effectiveShopDomain) {
      effectiveShopDomain = data.attributes?.shop_domain
    }
    if (!effectiveShopDomain) {
      throw new Error('shop_domain is required for Shopify products when not stored in product attributes')
    }

    let variantId = variant
    if (!variantId) {
      const variants = data.attributes?.variants
      if (variants && Array.isArray(variants) && variants.length > 0) {
        variantId = variants[0].id
      }
    }

    if (variantId) {
      const checkoutUrl = createShopifyCheckoutLink({ shopDomain: effectiveShopDomain, variantId, qty })
      debugLog('Shopify checkout link created:', { checkoutUrl })
      return { checkout_url: checkoutUrl }
    }
  }

  const pdpUrl = data.attributes?.pdp_url || data.attributes?.['pdp url']
  debugLog('Checkout link result (fallback):', { pdpUrl })
  return { checkout_url: pdpUrl || null }
} 