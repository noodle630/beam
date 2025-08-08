export function parseCatalogCSV(raw: string) {
    const rows = raw.split('\n').map(r => r.trim()).filter(Boolean)
    const headers = rows[0].split(',')
    const data = rows.slice(1).map(row => {
      const values = row.split(',')
      return Object.fromEntries(headers.map((h, i) => [h, values[i]]))
    })
    return data
  }
  