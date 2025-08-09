import { supabase } from './supabase'
import { MappingRule, TransformSpec, NormalizedProduct } from '../types/mapping'

// Core product fields that should be set directly on the product object
const CORE_FIELDS = new Set([
  'title', 'brand', 'category', 'price', 'currency', 'quantity', 'image_urls', 
  'sku', 'global_id_type', 'global_id_value', 'merchant_product_id', 
  'merchant_variant_id', 'condition', 'description'
])

/**
 * Normalize header for case-insensitive matching
 */
function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '') // Remove BOM
    .trim() // Remove outer spaces
    .replace(/\s+/g, ' ') // Collapse internal whitespace
    .toLowerCase() // Case insensitive
}

/**
 * Normalize attribute key to lower_snake_case
 */
function normalizeAttributeKey(key: string): string {
  return key
    .trim() // Remove outer spaces
    .replace(/\s+/g, ' ') // Collapse internal whitespace to single spaces
    .toLowerCase() // Convert to lowercase
    .replace(/[^a-zA-Z0-9_\s]/g, '_') // Replace non-alphanumerics with underscores
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_+/g, '_') // Collapse multiple underscores
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
}

/**
 * Auto-detect and split image URLs
 */
function autoSplitImageUrls(value: string): string[] {
  if (!value || typeof value !== 'string') return []
  
  let delimiter = '|'
  if (value.includes('|')) {
    delimiter = '|'
  } else if (value.includes(',')) {
    delimiter = ','
  } else {
    // Single URL, return as array
    return [value.trim()].filter(Boolean)
  }
  
  return value
    .split(delimiter)
    .map(url => url.trim())
    .filter(Boolean)
}

/**
 * Load mapping rules from field_mappings by org_slug + source='csv'
 */
export async function loadMappingRules(orgSlug: string): Promise<MappingRule[]> {
  const { data, error } = await supabase
    .from('field_mappings')
    .select('*')
    .eq('org_slug', orgSlug)
    .eq('source', 'csv')

  if (error) {
    console.error('Error loading mapping rules:', error)
    return []
  }

  return data.map(row => ({
    sourceField: row.source_field,
    internalField: row.internal_field,
    transform: row.transform_spec ? JSON.parse(row.transform_spec) : undefined
  }))
}

/**
 * Apply transforms in deterministic order: trim → lower/upper → regex → split/join → to_number
 */
function applyTransform(value: any, transform: TransformSpec): any {
  if (value === null || value === undefined) return value

  let result = value

  switch (transform.op) {
    case 'trim':
      result = String(result).trim()
      break

    case 'lower':
      result = String(result).toLowerCase()
      break

    case 'upper':
      result = String(result).toUpperCase()
      break

    case 'regex':
      if (transform.args?.pattern) {
        const regex = new RegExp(transform.args.pattern, transform.args.flags || '')
        const match = String(result).match(regex)
        result = match ? (transform.args.group ? match[transform.args.group] : match[0]) : result
      }
      break

    case 'split':
      const delimiter = transform.args?.delimiter || ','
      result = String(result)
        .split(delimiter)
        .map(s => s.trim())
        .filter(Boolean)
      break

    case 'join':
      const joinDelimiter = transform.args?.delimiter || ','
      result = Array.isArray(result) ? result.join(joinDelimiter) : String(result)
      break

    case 'to_number':
      const num = parseFloat(String(result).replace(/[^0-9.-]/g, ''))
      result = isNaN(num) ? 0 : num
      break

    default:
      // Unknown transform, leave unchanged
      break
  }

  return result
}

/**
 * Normalize condition values to standard enum
 */
function normalizeCondition(value: string): string {
  const normalized = value.toLowerCase().trim()
  switch (normalized) {
    case 'new':
    case 'brand new':
      return 'new'
    case 'used':
    case 'pre-owned':
      return 'used'
    case 'refurbished':
    case 'renewed':
      return 'refurbished'
    case 'open box':
    case 'open-box':
    case 'openbox':
      return 'open_box'
    default:
      return 'other'
  }
}

/**
 * Check if a value looks like a number (only digits, commas, dots, negative signs)
 */
function isNumericString(value: string): boolean {
  // Must start with optional negative sign, then contain only digits, commas, and at most one decimal point
  // Should not contain letters or symbols like $ % etc.
  return /^-?[\d,]+(\.\d+)?$/.test(value)
}

/**
 * Given a raw CSV row, apply mapping rules to produce NormalizedProduct
 */
export async function mapCsvRowToProduct(
  rawRow: Record<string, any>, 
  orgSlug: string,
  mappingRules?: MappingRule[]
): Promise<NormalizedProduct> {
  // Load mapping rules if not provided
  const rules = mappingRules || await loadMappingRules(orgSlug)

  // Create normalized header map for case-insensitive lookup
  const normalizedHeaders = new Map<string, string>()
  const headerMap: string[] = []
  
  for (const originalHeader of Object.keys(rawRow)) {
    const normalized = normalizeHeader(originalHeader)
    normalizedHeaders.set(normalized, originalHeader)
    headerMap.push(`"${originalHeader}" → "${normalized}"`)
  }

  // Log header mapping once per job
  if (process.env.DEBUG_INGEST) {
    console.log('Header map:', headerMap.join(', '))
  }

  const product: NormalizedProduct = {
    org_slug: orgSlug,
    attributes: {},
    source: 'csv',
    source_updated_at: new Date().toISOString()
  }

  // Track which headers we've mapped
  const mappedHeaders = new Set<string>()

  // Apply mapping rules
  for (const rule of rules) {
    const normalizedSourceField = normalizeHeader(rule.sourceField)
    const originalHeader = normalizedHeaders.get(normalizedSourceField)
    
    if (originalHeader) {
      const sourceValue = rawRow[originalHeader]
      mappedHeaders.add(originalHeader)
      
      if (process.env.DEBUG_INGEST) {
        console.log(`🔍 Matched rule: "${rule.sourceField}" → ${rule.internalField}`)
      }
      
      if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
        let mappedValue = sourceValue

        // Apply transform if specified
        if (rule.transform) {
          mappedValue = applyTransform(sourceValue, rule.transform)
          if (process.env.DEBUG_INGEST) {
            console.log(`   Transformed: ${sourceValue} → ${mappedValue}`)
          }
        }

        // Special handling for image_urls - auto-detect delimiter and always make it an array
        if (rule.internalField === 'image_urls') {
          if (Array.isArray(mappedValue)) {
            // Already an array from transform
            mappedValue = mappedValue.filter(Boolean)
          } else {
            // Auto-detect delimiter and split
            mappedValue = autoSplitImageUrls(String(mappedValue))
          }
        }

        // Special handling for condition - normalize to enum
        if (rule.internalField === 'condition') {
          mappedValue = normalizeCondition(String(mappedValue))
        }

        // Set the value on the appropriate field
        if (CORE_FIELDS.has(rule.internalField)) {
          (product as any)[rule.internalField] = mappedValue
          if (process.env.DEBUG_INGEST) {
            console.log(`   ✅ Set core field product.${rule.internalField} = ${mappedValue}`)
          }
        } else if (rule.internalField.startsWith('attributes.')) {
          const attrKey = rule.internalField.replace('attributes.', '')
          product.attributes[attrKey] = mappedValue
          if (process.env.DEBUG_INGEST) {
            console.log(`   ✅ Set attribute ${attrKey} = ${mappedValue}`)
          }
        } else {
          product.attributes[rule.internalField] = mappedValue
          if (process.env.DEBUG_INGEST) {
            console.log(`   ✅ Set attribute ${rule.internalField} = ${mappedValue}`)
          }
        }
      }
    }
  }

  // Handle unmapped fields - put them in attributes with normalized keys
  for (const [originalHeader, value] of Object.entries(rawRow)) {
    if (!mappedHeaders.has(originalHeader) && value !== undefined && value !== null && value !== '') {
      let attributeValue = value

      // Coerce obvious numbers
      if (typeof value === 'string' && isNumericString(value)) {
        const numValue = parseFloat(value.replace(/[,$]/g, ''))
        if (!isNaN(numValue)) {
          attributeValue = numValue
        }
      }

      // Normalize the key to lower_snake_case
      const normalizedKey = normalizeAttributeKey(originalHeader)
      product.attributes[normalizedKey] = attributeValue
      
      if (process.env.DEBUG_INGEST) {
        console.log(`   📦 Unmapped field ${originalHeader} → attributes.${normalizedKey} = ${attributeValue}`)
      }
    }
  }

  return product
}

/**
 * Get default mapping rules for common CSV headers
 */
export function getDefaultMappingRules(): MappingRule[] {
  return [
    { sourceField: 'Product Name', internalField: 'title' },
    { sourceField: 'Title', internalField: 'title' },
    { sourceField: 'Name', internalField: 'title' },
    { sourceField: 'MSRP', internalField: 'price', transform: { op: 'to_number' } },
    { sourceField: 'Price', internalField: 'price', transform: { op: 'to_number' } },
    { sourceField: 'Cost', internalField: 'price', transform: { op: 'to_number' } },
    { sourceField: 'Images', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: '|' } } },
    { sourceField: 'Image URLs', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: '|' } } },
    { sourceField: 'SKU', internalField: 'sku' },
    { sourceField: 'Brand', internalField: 'brand' },
    { sourceField: 'Category', internalField: 'category' },
    { sourceField: 'Description', internalField: 'description' },
    { sourceField: 'Quantity', internalField: 'quantity', transform: { op: 'to_number' } },
    { sourceField: 'Stock', internalField: 'quantity', transform: { op: 'to_number' } },
    { sourceField: 'Currency', internalField: 'currency' },
    { sourceField: 'Condition', internalField: 'condition' }
  ]
} 