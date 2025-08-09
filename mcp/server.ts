// Load environment variables from .env file
import 'dotenv/config'

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsRequest,
} from '@modelcontextprotocol/sdk/types.js'

import { 
  findProducts, 
  getProductDetails, 
  createCheckoutLink,
  validateFindProductsParams,
  validateOrgIdentifier,
  validateProductId
} from '../lib/mcpActions'

// Define MCP tools
const tools: any[] = [
  {
    name: 'find_products',
    description: 'Search for products by various criteria including text query, brand, category, price range, and custom attributes',
    inputSchema: {
      type: 'object',
      properties: {
        org_slug: {
          type: 'string',
          description: 'Organization slug (optional if shop_domain provided)'
        },
        shop_domain: {
          type: 'string', 
          description: 'Shopify shop domain (e.g., beam-devtest.myshopify.com)'
        },
        query: {
          type: 'string',
          description: 'Text search query (searches title, brand, category)'
        },
        brand: {
          type: 'string',
          description: 'Filter by brand name (for multiple brands, use comma-separated values)'
        },
        category: {
          type: 'string',
          description: 'Filter by category name (for multiple categories, use comma-separated values)'
        },
        condition: {
          type: 'string',
          description: 'Filter by condition (new, used, refurbished, etc. For multiple, use comma-separated values)'
        },
        price_min: {
          type: 'number',
          description: 'Minimum price filter'
        },
        price_max: {
          type: 'number', 
          description: 'Maximum price filter'
        },
        attributes: {
          type: 'object',
          description: 'Filter by custom product attributes (exact match)'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (1-100, default 20)',
          minimum: 1,
          maximum: 100
        }
      },
      required: []
    }
  },
  {
    name: 'get_product_details',
    description: 'Get detailed information about a specific product including full attributes and images',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'Unique product identifier'
        },
        org_slug: {
          type: 'string',
          description: 'Organization slug (optional if shop_domain provided)'
        },
        shop_domain: {
          type: 'string',
          description: 'Shopify shop domain (e.g., beam-devtest.myshopify.com)'
        }
      },
      required: ['product_id']
    }
  },
  {
    name: 'create_checkout_link',
    description: 'Generate a checkout/purchase link for a product, with support for Shopify cart links',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'Unique product identifier'
        },
        org_slug: {
          type: 'string',
          description: 'Organization slug (optional if shop_domain provided)'
        },
        shop_domain: {
          type: 'string',
          description: 'Shopify shop domain (e.g., beam-devtest.myshopify.com)'
        },
        variant: {
          type: 'string',
          description: 'Product variant ID (for Shopify products with multiple variants)'
        },
        qty: {
          type: 'number',
          description: 'Quantity to add to cart (default: 1)',
          minimum: 1
        }
      },
      required: ['product_id']
    }
  }
]

// Create server
const server = new Server(
  {
    name: 'beam-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools
  }
})

// Handle tool calls  
server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params
  if (!args) {
    throw new Error('Missing tool arguments')
  }

  try {
    switch (name) {
      case 'find_products': {
        const params = validateFindProductsParams(args)
        const results = await findProducts(params)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2)
            }
          ]
        }
      }

      case 'get_product_details': {
        const productId = validateProductId(args.product_id)
        const orgSlug = validateOrgIdentifier(args)
        const details = await getProductDetails(productId, orgSlug)
        return {
          content: [
            {
              type: 'text', 
              text: JSON.stringify(details, null, 2)
            }
          ]
        }
      }

      case 'create_checkout_link': {
        const productId = validateProductId(args.product_id)
        const orgSlug = validateOrgIdentifier(args)
        const variant = typeof args.variant === 'string' ? args.variant : undefined
        const qty = args.qty ? Number(args.qty) : 1
        const shopDomain = typeof args.shop_domain === 'string' ? args.shop_domain : undefined

        if (isNaN(qty) || qty < 1) {
          throw new Error('qty must be a positive number')
        }

        const link = await createCheckoutLink(productId, orgSlug, variant, qty, shopDomain)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(link, null, 2)
            }
          ]
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: errorMessage,
            details: 'The request could not be processed. Please check your parameters and try again.'
          }, null, 2)
        }
      ],
      isError: true
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('🚀 Beam MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
}) 