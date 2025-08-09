# Beam Model Context Protocol (MCP) Server

Beam provides a Model Context Protocol (MCP) server that allows AI agents to discover and interact with e-commerce products across different platforms.

## Overview

The MCP server exposes three main actions:
- **find_products**: Search for products with flexible filtering
- **get_product_details**: Get detailed product information  
- **create_checkout_link**: Generate purchase links for products

## Quick Start

### 1. Start the MCP Server

```bash
# Development (with hot reload)
npm run mcp

# Production (compiled)
npm run build
npm run mcp:dist
```

### 2. Test with Smoke Script

```bash
# Search for products
npm run mcp:smoke -- snowboard

# Get product details  
npm run mcp:smoke -- --details <product_id>

# Create checkout link
npm run mcp:smoke -- --checkout <product_id> --qty 2
```

## AI Agent Integrations

### Native MCP Support

#### Goose (Block) CLI
```bash
# Auto-configure Goose profile
npm run goose:profile

# Start Goose session
goose session start
```

**Example queries:**
- "Find snowboards under $900 from beam-devtest.myshopify.com"
- "Create a checkout link for the first result"

#### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "beam": {
      "command": "node",
      "args": ["/path/to/beam/dist/mcp/server.js"]
    }
  }
}
```

### HTTP Actions (ChatGPT & Perplexity)

For AI agents that don't support MCP natively, we provide HTTP Actions that mirror the MCP functionality.

#### ChatGPT Custom GPT
1. Import OpenAPI schema: `http://localhost:3000/openapi.json`
2. Configure API key authentication: `x-beam-api-key: dev-test-key`
3. Test with natural language queries

#### Perplexity Tools
- Same OpenAPI schema and authentication
- Automatic integration into research responses
- Real-time product data in conversations

## MCP Actions Reference

### find_products

Search for products with flexible filtering options.

**Parameters:**
```json
{
  "org_slug": "demo-brand",           // OR shop_domain
  "shop_domain": "store.myshopify.com", // Alternative to org_slug  
  "query": "snowboard",               // Text search
  "brand": ["Nike", "Adidas"],        // Filter by brands
  "category": ["sports", "apparel"],  // Filter by categories
  "price_min": 50,                    // Minimum price
  "price_max": 500,                   // Maximum price
  "attributes": {"color": "red"},     // Custom attribute filters
  "limit": 20                         // Max results (1-100)
}
```

**Response:**
```json
[
  {
    "product_id": "uuid-here",
    "title": "Product Name",
    "brand": "Brand Name",
    "category": "Category",
    "price": 99.99,
    "currency": "USD",
    "image": "https://example.com/image.jpg",
    "url": null
  }
]
```

### get_product_details

Get comprehensive product information including all attributes and images.

**Parameters:**
```json
{
  "product_id": "uuid-here",
  "org_slug": "demo-brand"  // OR shop_domain
}
```

**Response:**
```json
{
  "product_id": "uuid-here",
  "title": "Product Name",
  "brand": "Brand Name", 
  "category": "Category",
  "price": 99.99,
  "currency": "USD",
  "quantity": 50,
  "image_urls": ["https://example.com/image1.jpg"],
  "sku": "SKU123",
  "attributes": {
    "variants": [...],
    "pdp_url": "https://store.com/product",
    ...
  },
  "source": "shopify"
}
```

### create_checkout_link

Generate purchase links with Shopify cart support.

**Parameters:**
```json
{
  "product_id": "uuid-here",
  "org_slug": "demo-brand",  // OR shop_domain
  "variant": "variant-id",   // Optional: specific variant
  "qty": 2                   // Optional: quantity (default 1)
}
```

**Response:**
```json
{
  "checkout_url": "https://store.myshopify.com/cart/variant-id:2"
}
```

## Environment Variables

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# HTTP Actions (for ChatGPT/Perplexity)
BEAM_ACTIONS_API_KEY=dev-test-key

# Debug (optional)
DEBUG_MCP=1
DEBUG_HTTP_TOOLS=1
```

## Data Sources

The MCP server can work with products from multiple sources:

### Shopify
```bash
# Sync products from Shopify
npm run sync:shopify
```

### CSV Import
```bash
# Import from CSV files
curl -X POST http://localhost:3000/api/ingest-csv \
  -F "file=@products.csv" \
  -F "org_slug=my-store"
```

## Organization Identification

Both `org_slug` and `shop_domain` are supported for flexibility:

- **org_slug**: Direct organization identifier (e.g., "demo-brand")
- **shop_domain**: Shopify domain that gets converted to org_slug (e.g., "store.myshopify.com" → "store")

## Testing & Development

### Comprehensive Testing
See `docs/TESTING.md` for detailed testing instructions across all integrations.

### HTTP API Testing
```bash
# Test find products
curl -X POST http://localhost:3000/api/tools/find-products \
  -H "x-beam-api-key: dev-test-key" \
  -H "content-type: application/json" \
  -d '{"shop_domain":"beam-devtest.myshopify.com","query":"snowboard"}'
```

### Error Handling

The MCP server provides structured error responses:

```json
{
  "error": "Product not found",
  "details": "The request could not be processed. Please check your parameters and try again."
}
```

Common errors:
- Missing or invalid org_slug/shop_domain
- Product not found (404)
- Invalid parameters (400)
- Authentication failure (401)

## Integration Guides

- **Goose**: `docs/TESTING.md#goose-cli`
- **Claude Desktop**: `docs/TESTING.md#claude-desktop`  
- **ChatGPT**: `docs/CHATGPT_ACTIONS.md`
- **Perplexity**: `docs/PERPLEXITY.md`

## Architecture

```
AI Agent (Goose, Claude, ChatGPT, Perplexity)
    ↓
MCP Server / HTTP Actions API
    ↓
Shared Business Logic (lib/mcpActions.ts)
    ↓  
Supabase Database (products table)
    ↑
Shopify Connector / CSV Ingestion
```

## Production Deployment

1. **Build the application**: `npm run build`
2. **Deploy to your platform** (Vercel, Railway, etc.)
3. **Configure environment variables** with production values
4. **Update AI agent configurations** with production URLs
5. **Set secure API keys** for HTTP Actions

## Performance Considerations

- **Caching**: Consider implementing Redis for frequently accessed products
- **Pagination**: Large catalogs are automatically limited to 100 results
- **Indexing**: Database indexes on org_slug, source, and search fields
- **Deduplication**: Automatic deduplication for Shopify products
- **Rate Limiting**: Consider implementing for production HTTP APIs 