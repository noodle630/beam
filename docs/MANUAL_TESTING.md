# Manual Testing Guide

This guide provides working `curl` commands for testing Beam's HTTP Actions API manually.

## Prerequisites

1. **Start the dev server**: `npm run dev`
2. **Note the port**: Next.js will show which port it's using (usually 3000 or 3001)
3. **Environment**: Ensure your `.env` file has `BEAM_ACTIONS_API_KEY=dev-test-key`

## Working Commands

### 1. Find Products

```bash
# Search for snowboards
curl -X POST http://localhost:3000/api/tools/find-products \
  -H 'x-beam-api-key: dev-test-key' \
  -H 'content-type: application/json' \
  -d '{
    "shop_domain": "beam-devtest.myshopify.com",
    "query": "snowboard",
    "limit": 3
  }'
```

**Expected Response:**
```json
[
  {
    "product_id": "0cb70138-1c77-44f1-921d-f0999c370e8a",
    "title": "The Hidden Snowboard",
    "brand": "Snowboard Vendor",
    "category": "snowboard",
    "price": 50.95,
    "currency": "USD",
    "image": "https://cdn.shopify.com/s/files/1/0763/9990/2950/files/...",
    "url": null
  }
]
```

### 2. Get Product Details

```bash
# Get details for a specific product (use a real product_id from step 1)
curl -X POST http://localhost:3000/api/tools/get-product-details \
  -H 'x-beam-api-key: dev-test-key' \
  -H 'content-type: application/json' \
  -d '{
    "product_id": "0cb70138-1c77-44f1-921d-f0999c370e8a",
    "shop_domain": "beam-devtest.myshopify.com"
  }'
```

### 3. Create Checkout Link

```bash
# Create checkout for a product with quantity 2
curl -X POST http://localhost:3000/api/tools/create-checkout-link \
  -H 'x-beam-api-key: dev-test-key' \
  -H 'content-type: application/json' \
  -d '{
    "product_id": "0cb70138-1c77-44f1-921d-f0999c370e8a",
    "shop_domain": "beam-devtest.myshopify.com",
    "qty": 2
  }'
```

**Expected Response:**
```json
{
  "checkout_url": "https://beam-devtest.myshopify.com/cart/gid://shopify/ProductVariant/46527133941990:2"
}
```

## Troubleshooting

### Problem: 404 or Internal Server Error

**Solutions:**
1. **Check the port**: Next.js might be running on 3001 instead of 3000
2. **Clean restart**: 
   ```bash
   pkill -f "next dev"
   rm -rf .next
   npm run dev
   ```
3. **Use our automated tests**: `npm run test:http` (detects port automatically)

### Problem: "Invalid or missing API key"

**Solutions:**
1. Check your `.env` file has: `BEAM_ACTIONS_API_KEY=dev-test-key`
2. Ensure the header is exactly: `x-beam-api-key: dev-test-key`

### Problem: "Product not found"

**Solutions:**
1. Run `npm run sync:shopify` to import products
2. Use `npm run mcp:smoke -- snowboard` to get valid product IDs
3. Verify the `shop_domain` matches your Shopify store

## Quick Test Script

For convenience, use our automated tester:

```bash
# Test all endpoints automatically
npm run test:http

# Or run the full test suite
npm run test:all
```

## Port Detection

If you're unsure which port Next.js is using, check the startup message:

```
▲ Next.js 15.4.6
- Local:        http://localhost:3001  ← Use this port
```

Or use our port-aware test script that tries 3000, 3001, and 3002 automatically. 