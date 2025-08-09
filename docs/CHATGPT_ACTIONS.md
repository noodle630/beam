# ChatGPT Custom GPT Actions Integration

This guide shows how to integrate Beam with ChatGPT using Custom GPT Actions.

## Overview

ChatGPT Custom GPTs can call external APIs through Actions. We've created HTTP Actions that mirror our MCP functionality, making it easy to give ChatGPT access to your e-commerce product catalog.

## Step 1: Create a Custom GPT

1. Go to [ChatGPT](https://chat.openai.com)
2. Click "Explore" in the sidebar
3. Click "Create a GPT"
4. Configure your GPT with a name and description like:

   **Name**: "Beam Product Assistant"
   **Description**: "I help you find and explore products from Shopify stores integrated with Beam."

## Step 2: Import OpenAPI Schema

1. In the GPT editor, go to the "Configure" tab
2. Scroll down to "Actions"
3. Click "Create new action"
4. Click "Import from URL" and enter:
   ```
   http://localhost:3000/openapi.json
   ```
   
   **For production**: Replace with your deployed URL (e.g., `https://your-beam-app.vercel.app/openapi.json`)

5. The schema will be imported automatically with all three endpoints:
   - `POST /api/tools/find-products`
   - `POST /api/tools/get-product-details` 
   - `POST /api/tools/create-checkout-link`

## Step 3: Configure Authentication

1. In the Actions section, find "Authentication"
2. Select "API Key"
3. Set:
   - **API Key**: `dev-test-key` (or your production key)
   - **Auth Type**: "Custom"
   - **Custom Header Name**: `x-beam-api-key`

## Step 4: Test the Integration

### Example Prompts

Once your Custom GPT is configured, try these prompts:

#### Product Search
```
Find snowboards under $900 from beam-devtest.myshopify.com
```

#### Detailed Product Information
```
Show me details for the second result from my last search
```

#### Price Filtering
```
Find products from beam-devtest.myshopify.com with a maximum price of $500
```

#### Checkout Links
```
Create a checkout link for the first snowboard, quantity 2
```

#### Advanced Queries
```
Find products with "snowboard" in the name from beam-devtest.myshopify.com and create checkout links for the top 3 results
```

### Expected Behavior

The Custom GPT should:
- Call the appropriate Beam API endpoints
- Parse the JSON responses
- Present the information in a conversational format
- Handle errors gracefully
- Provide working checkout links for Shopify products

## Step 5: Production Deployment

### For Production Use

1. **Deploy your Beam app** to a service like Vercel, Netlify, or Railway
2. **Update the OpenAPI URL** to point to your production deployment
3. **Set a secure API key** in your production environment:
   ```env
   BEAM_ACTIONS_API_KEY=your-secure-production-key
   ```
4. **Update the Custom GPT** with the new API key

### Tunneling for Local Testing

If you want to test with a public URL before deploying:

```bash
# Install a tunneling tool
npm install -g localtunnel

# Expose your local server
npx localtunnel --port 3000
```

Then use the provided URL (e.g., `https://funny-name.loca.lt`) in your OpenAPI import.

## Advanced Configuration

### Custom Instructions

Add these instructions to your Custom GPT to improve its behavior:

```
You are a helpful e-commerce assistant that can search for products and create checkout links.

When showing product results:
- Display the title, brand, price, and category
- Include a brief description if available
- For Shopify products, always offer to create checkout links

When creating checkout links:
- Default to quantity 1 unless specified
- Explain that the link will add the item to their cart
- Mention the shop domain for clarity

Always be helpful and ask follow-up questions if the user's intent is unclear.
```

### Error Handling

Your Custom GPT should handle these scenarios:
- No products found for a query
- Invalid product IDs
- Products without checkout links
- API errors or timeouts

## Example Conversation Flow

```
User: Find snowboards under $900 from beam-devtest.myshopify.com

GPT: I found 3 snowboards under $900 from beam-devtest.myshopify.com:

1. **The Hidden Snowboard** - Snowboard Vendor
   - Price: $50.95 USD
   - Category: snowboard

2. **The Multi-managed Snowboard** - Multi-managed Vendor  
   - Price: $629.95 USD
   - Category: snowboard

3. **The Collection Snowboard: Liquid** - Hydrogen Vendor
   - Price: $899.35 USD (just under your budget!)
   - Category: snowboard

Would you like me to create checkout links for any of these, or would you like more details about a specific snowboard?

User: Create a checkout link for the first one

GPT: Perfect! I've created a checkout link for **The Hidden Snowboard**:

🛒 **Checkout Link**: https://beam-devtest.myshopify.com/cart/gid://shopify/ProductVariant/46527133941990:1

This link will add 1 unit of "The Hidden Snowboard" ($50.95) to your cart on beam-devtest.myshopify.com. Click the link to complete your purchase!
```

## Troubleshooting

### Common Issues

1. **"Actions not working"**
   - Verify your API key is correct
   - Check that your Beam app is running
   - Test the endpoints with curl first

2. **"Schema import failed"**
   - Ensure `/openapi.json` is accessible
   - Check for CORS issues
   - Verify the JSON is valid

3. **"Empty responses"**
   - Confirm you have products in your database
   - Run `npm run sync:shopify` to import test data
   - Check your Supabase environment variables

### Debug Mode

Enable debug logging in your environment:
```env
DEBUG_HTTP_TOOLS=1
```

Then check your server logs to see API calls and responses.

## Security Considerations

- **API Keys**: Use strong, unique keys for production
- **Rate Limiting**: Consider implementing rate limiting for production APIs
- **CORS**: The current setup allows all origins (`*`) - restrict this in production
- **Input Validation**: All inputs are validated, but monitor for abuse
- **Logging**: Be careful not to log sensitive information

## Next Steps

Once your ChatGPT integration is working:

1. **Expand to more stores**: Add more Shopify shops to your Beam instance
2. **Custom prompts**: Train your GPT with store-specific knowledge
3. **Advanced features**: Implement wishlist, comparison, or recommendation features
4. **Analytics**: Track which products are being searched for most
5. **User accounts**: Add user-specific features like purchase history 