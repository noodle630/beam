import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface ActionRequest {
  action: 'addToCart' | 'checkout' | 'search' | 'getProduct'
  productId?: string
  quantity?: number
  query?: string
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

export async function POST(
  request: Request,
  { params }: { params: { org: string } }
) {
  const { org } = params

  try {
    const body: ActionRequest = await request.json()
    const { action, productId, quantity = 1, query } = body

    switch (action) {
      case 'addToCart':
        // Placeholder for add to cart functionality
        return NextResponse.json({
          success: true,
          action: 'addToCart',
          productId,
          quantity,
          message: 'Product added to cart (placeholder)',
          cart: {
            items: [{ productId, quantity }],
            total: 0 // Will be calculated in future implementation
          }
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })

      case 'checkout':
        // Placeholder for checkout functionality
        return NextResponse.json({
          success: true,
          action: 'checkout',
          message: 'Checkout initiated (placeholder)',
          orderId: `order_${Date.now()}`,
          status: 'pending'
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })

      case 'search':
        // Search products by query
        if (!query) {
          return NextResponse.json({ error: 'Query parameter required for search' }, { status: 400 })
        }

        const { data: searchResults, error: searchError } = await supabase
          .from('products')
          .select('*')
          .eq('org_slug', org)
          .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
          .order('title')

        if (searchError) {
          return NextResponse.json({ error: searchError.message }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          action: 'search',
          query,
          results: searchResults || [],
          count: searchResults?.length || 0
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })

      case 'getProduct':
        // Get specific product details
        if (!productId) {
          return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
        }

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('org_slug', org)
          .single()

        if (productError) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        return NextResponse.json({
          success: true,
          action: 'getProduct',
          product
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('MCP actions error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: { org: string } }
) {
  // Return available actions for this organization
  return NextResponse.json({
    organization: params.org,
    availableActions: [
      {
        name: 'addToCart',
        description: 'Add a product to cart',
        parameters: ['productId', 'quantity']
      },
      {
        name: 'checkout',
        description: 'Initiate checkout process',
        parameters: []
      },
      {
        name: 'search',
        description: 'Search products by query',
        parameters: ['query']
      },
      {
        name: 'getProduct',
        description: 'Get specific product details',
        parameters: ['productId']
      }
    ]
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
} 