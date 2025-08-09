export interface ProductRow {
  [key: string]: any // Allow any fields from CSV
}

export function parseCatalogCSV(raw: string): ProductRow[] {
  const rows = raw.split('\n').map(r => r.trim()).filter(Boolean)
  
  if (rows.length < 2) {
    throw new Error('CSV must have at least a header row and one data row')
  }
  
  const headers = rows[0].split(',').map(h => h.trim())
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
      
      // Store all fields as-is, let the mapper handle the transformation
      if (value !== '') {
        rowData[header] = value
      }
    })
    
    return rowData as ProductRow
  })
  
  return data
}
  