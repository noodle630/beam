# Testing Guide

This guide provides instructions for testing Beam's AI agent integrations across different platforms.

## Goose CLI - Native MCP

### Setup

1. **Build Beam**: `npm run build`
2. **Install Goose**: Follow [installation guide](https://github.com/square/goose)
3. **Configure Profile**: `npm run goose:profile`

### Usage

Start a Goose session:
```bash
goose session start
```

### Example Queries

**Basic product search:**
```
Find snowboards under $900 from beam-devtest.myshopify.com
```

**Advanced filtering (using comma-separated values):**
```
Find products from brands "Hydrogen Vendor,Snowboard Vendor" under $800 from beam-devtest.myshopify.com
```

**Category filtering:**
```
Find snowboard,ski products under $1000 from beam-devtest.myshopify.com
```

**Get product details:**
```
Get details for product 0cb70138-1c77-44f1-921d-f0999c370e8a from beam-devtest.myshopify.com
```

**Create checkout:**
```
Create a checkout link for product 0cb70138-1c77-44f1-921d-f0999c370e8a with quantity 2 from beam-devtest.myshopify.com
```

### Parameter Format

For **brand**, **category**, and **condition** filters, you can use:
- **Single value**: `"Hydrogen Vendor"`
- **Multiple values**: `"Hydrogen Vendor,Snowboard Vendor"` (comma-separated)

### Expected Response

```
I found 3 snowboards under $900:

1. **The Hidden Snowboard** by Snowboard Vendor - $50.95
2. **The Collection Snowboard: Liquid** by Hydrogen Vendor - $899.35  
3. **The Multi-managed Snowboard** by Multi-managed Vendor - $629.95

Would you like details on any of these products or help creating a checkout link?
```

### Troubleshooting

**Problem: "Invalid schema" error in Goose**
```
Request failed: Invalid schema for function 'beam__find_products': schema must have 
type 'object' and not have 'oneOf'/'anyOf'/'allOf'/'enum'/'not' at the top level
```

**Solutions:**
1. **Rebuild the project**: `npm run build` 
2. **Update Goose profile**: `npm run goose:profile`
3. **Restart Goose**: Exit current session and run `goose session start`

**Problem: No products found**

**Solutions:**
1. Import products: `npm run sync:shopify`
2. Check environment variables in `.env`
3. Verify Shopify store domain: `beam-devtest.myshopify.com`
4. Test MCP directly: `npm run mcp:smoke -- snowboard`

**Problem: Goose can't connect to MCP server**

**Solutions:**
1. Ensure compiled server exists: `ls dist/mcp/server.js`
2. Test server manually: `npm run mcp:dist`
3. Check Goose config: `cat ~/.config/goose/profiles.yaml`
