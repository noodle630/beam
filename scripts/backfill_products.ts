import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.error('')
  console.error('Set these in your .env.local file')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface Product {
  id: string
  title?: string
  brand?: string
  category?: string
  price?: number
  currency?: string
  quantity?: number
  image_urls?: string[]
  attributes: Record<string, any>
}

/**
 * Auto-detect and split image URLs from legacy data
 */
function fixImageUrls(imageUrls: any): string[] {
  if (!imageUrls) return []
  
  // Already an array
  if (Array.isArray(imageUrls)) {
    return imageUrls.filter(url => url && typeof url === 'string').map(url => url.trim())
  }
  
  // String value - auto-detect delimiter
  if (typeof imageUrls === 'string') {
    let delimiter = '|'
    if (imageUrls.includes('|')) {
      delimiter = '|'
    } else if (imageUrls.includes(',')) {
      delimiter = ','
    } else {
      // Single URL
      return [imageUrls.trim()].filter(Boolean)
    }
    
    return imageUrls
      .split(delimiter)
      .map(url => url.trim())
      .filter(Boolean)
  }
  
  return []
}

/**
 * Normalize attribute key to match expected core field format
 */
function normalizeAttributeKey(key: string): string {
  return key
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Check if a value from attributes can be used for a core field
 */
function canUseAttributeValue(value: any, fieldType: 'string' | 'number'): boolean {
  if (value === null || value === undefined || value === '') return false
  
  if (fieldType === 'number') {
    const num = typeof value === 'number' ? value : parseFloat(String(value))
    return !isNaN(num) && isFinite(num)
  }
  
  return typeof value === 'string' || typeof value === 'number'
}

async function backfillProducts() {
  console.log('🚀 Starting product backfill...')
  
  try {
    // Fetch all products
    const { data: products, error } = await supabase
      .from('products')
      .select('id, title, brand, category, price, currency, quantity, image_urls, attributes')
    
    if (error) {
      console.error('❌ Error fetching products:', error)
      return
    }
    
    console.log(`📦 Found ${products.length} products to process`)
    
    let totalUpdated = 0
    let imageUrlsFixed = 0
    let attributesCopied = 0
    
    for (const product of products as Product[]) {
      const updates: Partial<Product> = {}
      let hasUpdates = false
      
      // Fix image_urls if needed
      if (product.image_urls) {
        const fixedUrls = fixImageUrls(product.image_urls)
        const originalUrls = Array.isArray(product.image_urls) ? product.image_urls : []
        
        // Check if fixing actually changed something
        const urlsChanged = JSON.stringify(fixedUrls) !== JSON.stringify(originalUrls)
        
        if (urlsChanged && fixedUrls.length > 0) {
          updates.image_urls = fixedUrls
          hasUpdates = true
          imageUrlsFixed++
        }
      }
      
      // Check core fields that might be null but have values in attributes
      const coreFieldMapping = {
        title: ['title', 'product_name', 'name'],
        brand: ['brand', 'manufacturer'],
        category: ['category', 'type', 'product_type'],
        price: ['price', 'msrp', 'cost'],
        currency: ['currency', 'curr'],
        quantity: ['quantity', 'stock', 'qty']
      }
      
      for (const [coreField, possibleKeys] of Object.entries(coreFieldMapping)) {
        const currentValue = (product as any)[coreField]
        
        // Only update if core field is null/undefined/empty
        if (currentValue === null || currentValue === undefined || currentValue === '') {
          for (const key of possibleKeys) {
            const normalizedKey = normalizeAttributeKey(key)
            const attributeValue = product.attributes[normalizedKey] || product.attributes[key]
            
            if (attributeValue !== undefined && attributeValue !== null && attributeValue !== '') {
              const fieldType = ['price', 'quantity'].includes(coreField) ? 'number' : 'string'
              
              if (canUseAttributeValue(attributeValue, fieldType)) {
                if (fieldType === 'number') {
                  (updates as any)[coreField] = typeof attributeValue === 'number' 
                    ? attributeValue 
                    : parseFloat(String(attributeValue))
                } else {
                  (updates as any)[coreField] = String(attributeValue)
                }
                
                hasUpdates = true
                attributesCopied++
                console.log(`   📋 Copying ${key} → ${coreField}: ${attributeValue}`)
                break // Use first matching attribute
              }
            }
          }
        }
      }
      
      // Apply updates if any
      if (hasUpdates) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', product.id)
        
        if (updateError) {
          console.error(`❌ Error updating product ${product.id}:`, updateError)
        } else {
          totalUpdated++
          if (totalUpdated <= 10) { // Show first 10 for debugging
            console.log(`✅ Updated product ${product.id}:`, updates)
          }
        }
      }
    }
    
    console.log('\n📊 Backfill Summary:')
    console.log(`   Total products processed: ${products.length}`)
    console.log(`   Products updated: ${totalUpdated}`)
    console.log(`   Image URLs fixed: ${imageUrlsFixed}`)
    console.log(`   Attributes copied to core fields: ${attributesCopied}`)
    
    if (totalUpdated === 0) {
      console.log('✅ No products needed updates - all data is already clean!')
    } else {
      console.log('✅ Backfill completed successfully!')
    }
    
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  }
}

// Run the backfill
if (require.main === module) {
  backfillProducts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Backfill script failed:', error)
      process.exit(1)
    })
}

export { backfillProducts } 