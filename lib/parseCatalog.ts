export interface ProductRow {
  title: string
  description: string
  price: number
  org_slug?: string
}

export function parseCatalogCSV(raw: string): ProductRow[] {
  const rows = raw.split('\n').map(r => r.trim()).filter(Boolean)
  
  if (rows.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }
  
  const headers = rows[0].split(',').map(h => h.trim().toLowerCase())
  const data = rows.slice(1).map((row, index) => {
    // Handle quoted values properly by splitting on commas outside quotes
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim()) // Add the last value
    
    // Ensure we have the same number of values as headers
    while (values.length < headers.length) {
      values.push('')
    }
    
    const rowData: any = {}
    headers.forEach((header, i) => {
      let value = values[i] || ''
      
      // Remove quotes from the beginning and end if they exist
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1)
      }
      
      // Only include fields that exist in our Supabase table
      if (['title', 'description', 'price'].includes(header)) {
        if (header === 'price') {
          // Convert price to number, handle various formats
          const cleanValue = value.replace(/[$,]/g, '').trim()
          const numValue = parseFloat(cleanValue)
          rowData[header] = isNaN(numValue) ? 0 : numValue
        } else {
          rowData[header] = value
        }
      }
    })
    
    // Validate required fields
    if (!rowData.title) {
      throw new Error(`Row ${index + 2}: Missing required field 'title'`)
    }
    if (!rowData.description) {
      throw new Error(`Row ${index + 2}: Missing required field 'description'`)
    }
    if (rowData.price === undefined || rowData.price === null) {
      throw new Error(`Row ${index + 2}: Missing required field 'price'`)
    }
    
    return rowData as ProductRow
  })
  
  return data
}
  