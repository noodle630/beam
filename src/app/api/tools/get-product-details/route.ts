import { NextRequest, NextResponse } from 'next/server'
import { getProductDetails, validateOrgIdentifier, validateProductId } from '../../../../../lib/mcpActions'

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
      console.log('[HTTP Tools] POST /api/tools/get-product-details', {
        method: 'get-product-details',
        args: body
      })
    }

    // Validate parameters
    const productId = validateProductId(body.product_id)
    const orgSlug = validateOrgIdentifier(body)

    // Execute the action
    const result = await getProductDetails(productId, orgSlug)

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
      console.error('[HTTP Tools] Error in get-product-details:', errorMessage)
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