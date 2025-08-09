import { NextRequest, NextResponse } from 'next/server'
import { createCheckoutLink, validateOrgIdentifier, validateProductId } from '../../../../../lib/mcpActions'

// Enable CORS for API endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-beam-api-key',
    },
  })
}

export async function POST(request: NextRequest) {
  // Validate API key
  const apiKey = request.headers.get('x-beam-api-key')
  const validApiKey = process.env.BEAM_ACTIONS_API_KEY

  if (!validApiKey) {
    console.error('BEAM_ACTIONS_API_KEY not configured')
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (!apiKey || apiKey !== validApiKey) {
    return NextResponse.json(
      { error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  try {
    // Parse request body
    const body = await request.json()

    // Debug logging
    if (process.env.DEBUG_HTTP_TOOLS) {
      console.log('[HTTP Tools] POST /api/tools/create-checkout-link', {
        method: 'create-checkout-link',
        args: body
      })
    }

    // Validate parameters
    const productId = validateProductId(body.product_id)
    const orgSlug = validateOrgIdentifier(body)
    const variant = typeof body.variant === 'string' ? body.variant : undefined
    const qty = body.qty ? Number(body.qty) : 1
    const shopDomain = typeof body.shop_domain === 'string' ? body.shop_domain : undefined

    if (isNaN(qty) || qty < 1) {
      throw new Error('qty must be a positive number')
    }

    // Execute the action
    const result = await createCheckoutLink(productId, orgSlug, variant, qty, shopDomain)

    // Return the result with CORS headers
    return NextResponse.json(result, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-beam-api-key',
      },
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (process.env.DEBUG_HTTP_TOOLS) {
      console.error('[HTTP Tools] Error in create-checkout-link:', errorMessage)
    }

    // Handle 404 for not found
    const status = errorMessage === 'Product not found' ? 404 : 400

    return NextResponse.json(
      {
        error: errorMessage,
        details: 'The request could not be processed. Please check your parameters and try again.'
      },
      {
        status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-beam-api-key',
        },
      }
    )
  }
} 