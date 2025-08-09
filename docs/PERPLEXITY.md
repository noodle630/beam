# Perplexity Tools Integration

This guide shows how to integrate Beam with Perplexity using their Tools feature.

## Overview

Perplexity Tools allows you to connect external APIs to enhance Perplexity's responses with real-time data. Our HTTP Actions API is compatible with Perplexity's tool requirements.

## Step 1: Access Perplexity Tools

1. Go to [Perplexity](https://perplexity.ai)
2. Look for "Tools" or "Integrations" in the settings
3. Select "Add Custom Tool" or "Import API"

**Note**: Perplexity Tools feature availability may vary by subscription tier.

## Step 2: Import API Schema

### Option A: OpenAPI Import (Recommended)

If Perplexity supports OpenAPI import:

1. Enter the schema URL:
   ```
   http://localhost:3000/openapi.json
   ```
   
   **For production**: Use your deployed URL

2. Configure authentication:
   - **Type**: API Key
   - **Header**: `x-beam-api-key`
   - **Value**: `dev-test-key`

### Option B: Manual Configuration

If manual configuration is required, add these three functions:

#### Find Products
```json
{
  "name": "find_products",
  "description": "Search for products by various criteria",
  "endpoint": "http://localhost:3000/api/tools/find-products",
  "method": "POST",
  "headers": {
    "x-beam-api-key": "dev-test-key",
    "content-type": "application/json"
  },
  "parameters": {
    "shop_domain": {
      "type": "string",
      "description": "Shopify shop domain (e.g., 'store.myshopify.com')",
      "required": false
    },
    "org_slug": {
      "type": "string", 
      "description": "Organization slug (alternative to shop_domain)",
      "required": false
    },
    "query": {
      "type": "string",
      "description": "Text search query",
      "required": false
    },
    "price_max": {
      "type": "number",
      "description": "Maximum price filter",
      "required": false
    },
    "limit": {
      "type": "integer",
      "description": "Maximum number of results (1-100)",
      "required": false
    }
  }
}
```

#### Get Product Details
```json
{
  "name": "get_product_details",
  "description": "Get detailed information about a specific product",
  "endpoint": "http://localhost:3000/api/tools/get-product-details",
  "method": "POST",
  "headers": {
    "x-beam-api-key": "dev-test-key",
    "content-type": "application/json"
  },
  "parameters": {
    "product_id": {
      "type": "string",
      "description": "Unique product identifier",
      "required": true
    },
    "shop_domain": {
      "type": "string",
      "description": "Shopify shop domain",
      "required": false
    },
    "org_slug": {
      "type": "string",
      "description": "Organization slug (alternative to shop_domain)", 
      "required": false
    }
  }
}
```

#### Create Checkout Link
```json
{
  "name": "create_checkout_link",
  "description": "Generate a checkout/purchase link for a product",
  "endpoint": "http://localhost:3000/api/tools/create-checkout-link",
  "method": "POST",
  "headers": {
    "x-beam-api-key": "dev-test-key",
    "content-type": "application/json"
  },
  "parameters": {
    "product_id": {
      "type": "string",
      "description": "Unique product identifier",
      "required": true
    },
    "shop_domain": {
      "type": "string",
      "description": "Shopify shop domain",
      "required": false
    },
    "org_slug": {
      "type": "string",
      "description": "Organization slug (alternative to shop_domain)",
      "required": false
    },
    "qty": {
      "type": "integer",
      "description": "Quantity to add to cart (default: 1)",
      "required": false
    }
  }
}
```

## Step 3: Test the Integration

### Example Queries

Once configured, try these queries in Perplexity:

#### Product Discovery
```
Find snowboards under $900 from beam-devtest.myshopify.com
```

```
What snowboards are available from beam-devtest.myshopify.com and what are their prices?
```

#### Product Comparison
```
Compare the top 3 snowboards from beam-devtest.myshopify.com by price and features
```

#### Purchase Assistance
```
I want to buy The Hidden Snowboard from beam-devtest.myshopify.com, can you create a checkout link?
```

#### Advanced Research
```
Find the most expensive and cheapest snowboards from beam-devtest.myshopify.com and explain the differences
```

### Expected Behavior

Perplexity should:
- Automatically call Beam APIs when relevant to user queries
- Integrate product data into conversational responses
- Provide accurate, real-time product information
- Generate working checkout links when requested
- Handle errors gracefully and suggest alternatives

## Sample Conversation Flow

```
User: What snowboards are available from beam-devtest.myshopify.com under $700?

Perplexity: I found several snowboards under $700 from beam-devtest.myshopify.com:

**The Hidden Snowboard** - $50.95
- Brand: Snowboard Vendor
- Category: Snowboard
- This is the most budget-friendly option available

**The Multi-managed Snowboard** - $629.95  
- Brand: Multi-managed Vendor
- Category: Snowboard
- Mid-range pricing with good value

These are both significantly under your $700 budget. The Hidden Snowboard offers exceptional value at under $51, while the Multi-managed option provides a premium experience at $630.

Would you like more details about either of these snowboards, or would you like me to create a checkout link for one of them?

User: Tell me more about The Hidden Snowboard and create a checkout link

Perplexity: Here are the detailed specs for **The Hidden Snowboard**:

**Product Details:**
- **Price**: $50.95 USD
- **Brand**: Snowboard Vendor  
- **Category**: Snowboard
- **Availability**: 50 units in stock
- **Tags**: Premium, Snow, Snowboard, Sport, Winter

**Purchase Link:**
I've created a checkout link for you: https://beam-devtest.myshopify.com/cart/gid://shopify/ProductVariant/46527133941990:1

This link will add The Hidden Snowboard to your cart on beam-devtest.myshopify.com. At $50.95, it's an excellent entry-level snowboard with premium features.
```

## Advanced Use Cases

### Product Research
```
Research the snowboard market on beam-devtest.myshopify.com and provide insights on pricing trends
```

### Recommendations
```
I'm a beginner snowboarder with a budget of $800. What would you recommend from beam-devtest.myshopify.com?
```

### Inventory Analysis
```
What's the total value of snowboard inventory on beam-devtest.myshopify.com?
```

## Troubleshooting

### Common Issues

1. **Tools not triggering**
   - Check that your API endpoints are accessible
   - Verify the API key is correct
   - Ensure the tool configurations match the OpenAPI schema

2. **Authentication errors**
   - Confirm the header name is `x-beam-api-key`
   - Check that the API key value matches your environment variable
   - Test the endpoints manually with curl

3. **Empty or incorrect responses**
   - Verify you have product data in your database
   - Run `npm run sync:shopify` to populate test data
   - Check that your Supabase configuration is correct

### Testing Tools Directly

Test the integration with curl to debug issues:

```bash
# Test find products
curl -X POST http://localhost:3000/api/tools/find-products \
  -H "x-beam-api-key: dev-test-key" \
  -H "content-type: application/json" \
  -d '{"shop_domain":"beam-devtest.myshopify.com","query":"snowboard","limit":3}'
```

## Production Considerations

### Security
- Use strong API keys in production
- Implement rate limiting if needed
- Monitor API usage for abuse

### Performance
- Consider caching frequently accessed product data
- Implement pagination for large product catalogs
- Monitor response times and optimize queries

### Reliability
- Set up monitoring and alerting
- Implement graceful error handling
- Provide fallback responses when APIs are unavailable

## Integration Benefits

Using Beam with Perplexity provides:

1. **Real-time product data** in AI responses
2. **Natural language product discovery** 
3. **Automated checkout link generation**
4. **Cross-store product comparison**
5. **Dynamic pricing and inventory information**
6. **Enhanced e-commerce research capabilities**

## Next Steps

Once your Perplexity integration is working:

1. **Monitor usage patterns** to understand user behavior
2. **Expand product catalogs** by connecting more Shopify stores
3. **Optimize responses** based on user feedback
4. **Add more product attributes** for richer comparisons
5. **Implement analytics** to track successful conversions 