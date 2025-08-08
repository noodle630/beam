// src/app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { parseCatalogCSV } from '@/lib/parseCatalog'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const text = await file.text()

  // ✅ Use your real parser
  const parsed = parseCatalogCSV(text)

  return NextResponse.json({ rows: parsed.length, preview: parsed.slice(0, 3) }) // preview helps with debugging
}
