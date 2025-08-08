import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Product {
  id: string
  title: string
  description: string
  price: number
  org_slug: string
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(
  request: Request,
  { params }: { params: { org: string } }
) {
  const { org } = params

  try {
    // Fetch products for this organization
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .eq('org_slug', org)
      .order('title')

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Transform products into MCP-compatible format
    const mcpContext = {
      organization: {
        slug: org,
        name: org.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        productCount: products.length
      },
      products: products.map((product: Product) => ({
        id: product.id,
        title: product.title,
        description: product.description,
        price: parseFloat(product.price.toString()),
        priceFormatted: `$${parseFloat(product.price.toString()).toFixed(2)}`,
        available: true, // Assuming all products are available for now
        category: 'general', // Default category
        tags: [], // Empty tags for now
        metadata: {
          org_slug: product.org_slug,
          lastUpdated: new Date().toISOString()
        }
      })),
      catalog: {
        totalProducts: products.length,
        priceRange: {
          min: Math.min(...products.map(p => parseFloat(p.price.toString()))),
          max: Math.max(...products.map(p => parseFloat(p.price.toString())))
        },
        categories: ['general'], // Default category for now
        lastUpdated: new Date().toISOString()
      }
    }

    return NextResponse.json(mcpContext, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    })
  } catch (error) {
    console.error('MCP context error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 