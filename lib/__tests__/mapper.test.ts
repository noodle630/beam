import { mapCsvRowToProduct, getDefaultMappingRules } from '../mapper'
import { MappingRule } from '../../types/mapping'

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({ data: [], error: null }))
        }))
      }))
    }))
  }
}))

describe('Header Normalization', () => {
  beforeEach(() => {
    // Clear DEBUG_INGEST to reduce noise in tests
    delete process.env.DEBUG_INGEST
  })

  it('should normalize headers with different cases', async () => {
    const rawRow = {
      ' Brand ': 'TestBrand'
    }

    const rules: MappingRule[] = [
      { sourceField: 'Brand', internalField: 'brand' }
    ]

    const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)

    expect(result.brand).toBe('TestBrand')
  })

  it('should handle BOM and whitespace normalization', async () => {
    const rawRow = {
      '\uFEFF  Product  Name  ': 'Test Product',
      '  price  ': '29.99'
    }

    const rules: MappingRule[] = [
      { sourceField: 'Product Name', internalField: 'title' },
      { sourceField: 'Price', internalField: 'price', transform: { op: 'to_number' } }
    ]

    const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)

    expect(result.title).toBe('Test Product')
    expect(result.price).toBe(29.99)
  })

  it('should handle case-insensitive matching', async () => {
    const rawRow = {
      'PRODUCT NAME': 'Test Product',
      'brand': 'TestBrand',
      'PRICE': '49.99'
    }

    const result = await mapCsvRowToProduct(rawRow, 'test-org', getDefaultMappingRules())

    expect(result.title).toBe('Test Product')
    expect(result.brand).toBe('TestBrand')
    expect(result.price).toBe(49.99)
  })
})

describe('Transform Operations', () => {
  beforeEach(() => {
    delete process.env.DEBUG_INGEST
  })

  it('should apply transforms in correct order', async () => {
    const rawRow = {
      'Images': ' https://ex.com/a.jpg | https://ex.com/b.jpg ',
      'Price': '$1,234.56',
      'Description': '  SOME DESCRIPTION  '
    }

    const rules: MappingRule[] = [
      { sourceField: 'Images', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: '|' } } },
      { sourceField: 'Price', internalField: 'price', transform: { op: 'to_number' } },
      { sourceField: 'Description', internalField: 'description', transform: { op: 'trim' } }
    ]

    const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)

    expect(result.image_urls).toEqual(['https://ex.com/a.jpg', 'https://ex.com/b.jpg'])
    expect(result.price).toBe(1234.56)
    expect(result.description).toBe('SOME DESCRIPTION')
  })

  it('should normalize condition values', async () => {
    const testCases = [
      { input: 'NEW', expected: 'new' },
      { input: 'brand new', expected: 'new' },
      { input: 'Used', expected: 'used' },
      { input: 'Pre-owned', expected: 'used' },
      { input: 'Refurbished', expected: 'refurbished' },
      { input: 'Open Box', expected: 'open_box' },
      { input: 'unknown', expected: 'other' }
    ]

    for (const testCase of testCases) {
      const rawRow = { 'Condition': testCase.input }
      const rules: MappingRule[] = [
        { sourceField: 'Condition', internalField: 'condition' }
      ]

      const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)
      expect(result.condition).toBe(testCase.expected)
    }
  })

  it('should auto-detect image delimiter and create arrays', async () => {
    const testCases = [
      { 
        input: 'img1.jpg,img2.jpg', 
        expected: ['img1.jpg', 'img2.jpg'],
        description: 'comma-separated'
      },
      { 
        input: 'img1.jpg|img2.jpg|img3.jpg', 
        expected: ['img1.jpg', 'img2.jpg', 'img3.jpg'],
        description: 'pipe-separated'
      },
      { 
        input: 'single-image.jpg', 
        expected: ['single-image.jpg'],
        description: 'single URL'
      }
    ]

    for (const testCase of testCases) {
      const rawRow = { 'Images': testCase.input }
      const rules: MappingRule[] = [
        { sourceField: 'Images', internalField: 'image_urls' } // No explicit transform
      ]

      const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)
      expect(result.image_urls).toEqual(testCase.expected)
    }
  })

  it('should handle explicit split transform with delimiter override', async () => {
    const rawRow = { 'Images': 'img1.jpg;img2.jpg;img3.jpg' }
    const rules: MappingRule[] = [
      { sourceField: 'Images', internalField: 'image_urls', transform: { op: 'split', args: { delimiter: ';' } } }
    ]

    const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)
    expect(result.image_urls).toEqual(['img1.jpg', 'img2.jpg', 'img3.jpg'])
  })
})

describe('Field Assignment', () => {
  beforeEach(() => {
    delete process.env.DEBUG_INGEST
  })

  it('should assign core fields to product object', async () => {
    const rawRow = {
      'Product Name': 'Test Product',
      'Brand': 'TestBrand',
      'Price': '29.99',
      'SKU': 'TEST-001'
    }

    const result = await mapCsvRowToProduct(rawRow, 'test-org', getDefaultMappingRules())

    expect(result.title).toBe('Test Product')
    expect(result.brand).toBe('TestBrand')
    expect(result.price).toBe(29.99)
    expect(result.sku).toBe('TEST-001')
  })

  it('should handle attributes.* mapping', async () => {
    const rawRow = {
      'Custom Field': 'Custom Value'
    }

    const rules: MappingRule[] = [
      { sourceField: 'Custom Field', internalField: 'attributes.custom_field' }
    ]

    const result = await mapCsvRowToProduct(rawRow, 'test-org', rules)

    expect(result.attributes.custom_field).toBe('Custom Value')
  })

  it('should put unmapped fields in attributes with normalized lower_snake_case keys', async () => {
    const rawRow = {
      'Product Name': 'Test Product',
      'Custom-Field!': 'Custom Value',
      'Another@Field': 'Another Value',
      'Numeric Field': '123',
      'PDP URL': 'https://example.com'
    }

    const result = await mapCsvRowToProduct(rawRow, 'test-org', getDefaultMappingRules())

    expect(result.title).toBe('Test Product')
    // Normalized keys: remove non-alphanumeric, replace with _, collapse multiple _, trim edges
    expect(result.attributes['custom_field']).toBe('Custom Value')
    expect(result.attributes['another_field']).toBe('Another Value')
    expect(result.attributes['numeric_field']).toBe(123) // Should be coerced to number
    expect(result.attributes['pdp_url']).toBe('https://example.com')
  })
})

describe('Sample CSV Integration', () => {
  beforeEach(() => {
    delete process.env.DEBUG_INGEST
  })

  it('should correctly process the sample CSV format', async () => {
    const rawRow = {
      'Product Name': 'Trail Runner Shoe',
      'Brand': 'Allbirds',
      'Category': 'Shoes',
      'Price': '135',
      'Currency': 'USD',
      'Quantity': '12',
      'Images': 'https://ex.com/a.jpg|https://ex.com/b.jpg',
      'SKU': 'AB-TR-01',
      'GlobalIDType': 'gtin',
      'GlobalID': '123456789012',
      'Condition': 'new',
      'Description': 'Foam sole',
      'Color': 'Black',
      'Size': '10',
      'PDP URL': 'https://store.example.com/p/ab-tr-01'
    }

    const result = await mapCsvRowToProduct(rawRow, 'demo-brand', getDefaultMappingRules())

    // Core fields should be set correctly
    expect(result.title).toBe('Trail Runner Shoe')
    expect(result.brand).toBe('Allbirds')
    expect(result.category).toBe('Shoes')
    expect(result.price).toBe(135)
    expect(result.currency).toBe('USD')
    expect(result.quantity).toBe(12)
    expect(result.image_urls).toEqual(['https://ex.com/a.jpg', 'https://ex.com/b.jpg'])
    expect(result.condition).toBe('new')
    expect(result.description).toBe('Foam sole')
    expect(result.sku).toBe('AB-TR-01')

    // Unmapped fields should go to attributes with normalized keys
    expect(result.attributes['globalidtype']).toBe('gtin')
    expect(result.attributes['globalid']).toBe(123456789012) // Numeric string coerced to number
    expect(result.attributes['color']).toBe('Black')
    expect(result.attributes['size']).toBe(10) // Should be coerced to number
    expect(result.attributes['pdp_url']).toBe('https://store.example.com/p/ab-tr-01')

    // Meta fields should be set
    expect(result.org_slug).toBe('demo-brand')
    expect(result.source).toBe('csv')
    expect(result.source_updated_at).toBeDefined()
  })
})

describe('Edge Cases', () => {
  beforeEach(() => {
    delete process.env.DEBUG_INGEST
  })

  it('should handle empty and null values gracefully', async () => {
    const rawRow = {
      'Product Name': 'Test Product',
      'Empty': '',
      'Null': null,
      'Undefined': undefined,
      'Valid': 'value'
    }

    const result = await mapCsvRowToProduct(rawRow, 'test-org', getDefaultMappingRules())

    expect(result.title).toBe('Test Product')
    expect(result.attributes.valid).toBe('value')
    expect(result.attributes.empty).toBeUndefined()
    expect(result.attributes.null).toBeUndefined()
    expect(result.attributes.undefined).toBeUndefined()
  })

  it('should handle numeric string coercion in attributes', async () => {
    const rawRow = {
      'Product Name': 'Test Product',
      'Weight': '10.5',
      'Count': '100',
      'Price with Currency': '$29.99',
      'Notes': 'Not a number'
    }

    const result = await mapCsvRowToProduct(rawRow, 'test-org', getDefaultMappingRules())

    expect(result.title).toBe('Test Product')
    expect(result.attributes.weight).toBe(10.5)
    expect(result.attributes.count).toBe(100)
    expect(result.attributes['price_with_currency']).toBe('$29.99') // Not a pure number, stays as string
    expect(result.attributes.notes).toBe('Not a number')
  })
}) 