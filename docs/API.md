# Beam API Documentation

## Overview

Beam provides MCP (Model Context Protocol) compatible endpoints that allow AI agents to access and interact with e-commerce product catalogs.

## Endpoints

### 1. Product Catalog Context

**Endpoint:** `GET /api/mcp/[org]/context`

Returns a structured JSON representation of an organization's product catalog in MCP-compatible format.

**Example Request:**
```bash
curl https://your-domain.com/api/mcp/demo-brand/context
```

**Example Response:**
```json
{
  "organization": {
    "slug": "demo-brand",
    "name": "Demo Brand",
    "productCount": 5
  },
  "products": [
    {
      "id": "123",
      "title": "Sample Product",
      "description": "A great product description",
      "price": 29.99,
      "priceFormatted": "$29.99",
      "available": true,
      "category": "general",
      "tags": [],
      "metadata": {
        "org_slug": "demo-brand",
        "lastUpdated": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "catalog": {
    "totalProducts": 5,
    "priceRange": {
      "min": 9.99,
      "max": 99.99
    },
    "categories": ["general"],
    "lastUpdated": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Product Actions

**Endpoint:** `POST /api/mcp/[org]/actions`

Performs actions on products like adding to cart, checkout, search, and getting product details.

**Available Actions:**

#### Add to Cart
```json
{
  "action": "addToCart",
  "productId": "123",
  "quantity": 2
}
```

#### Search Products
```json
{
  "action": "search",
  "query": "wireless headphones"
}
```

#### Get Product Details
```json
{
  "action": "getProduct",
  "productId": "123"
}
```

#### Checkout
```json
{
  "action": "checkout"
}
```

**Example Request:**
```bash
curl -X POST https://your-domain.com/api/mcp/demo-brand/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "search", "query": "headphones"}'
```

### 3. Available Actions

**Endpoint:** `GET /api/mcp/[org]/actions`

Returns a list of available actions for an organization.

**Example Response:**
```json
{
  "organization": "demo-brand",
  "availableActions": [
    {
      "name": "addToCart",
      "description": "Add a product to cart",
      "parameters": ["productId", "quantity"]
    },
    {
      "name": "checkout",
      "description": "Initiate checkout process",
      "parameters": []
    },
    {
      "name": "search",
      "description": "Search products by query",
      "parameters": ["query"]
    },
    {
      "name": "getProduct",
      "description": "Get specific product details",
      "parameters": ["productId"]
    }
  ]
}
```

## Organization Pages

**Endpoint:** `GET /org/[org]`

Displays a human-readable product catalog for a specific organization.

**Example:** `https://your-domain.com/org/demo-brand`

## File Upload

**Endpoint:** `POST /api/upload`

Uploads a CSV file containing product catalog data.

**CSV Format:**
```csv
title,description,price
Product 1,Description 1,29.99
Product 2,Description 2,49.99
```

**Example Request:**
```bash
curl -X POST https://your-domain.com/api/upload \
  -F "file=@products.csv"
```

## CORS Support

All MCP endpoints support CORS and can be accessed from any origin. The following headers are included in all responses:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing parameters, invalid action)
- `404` - Not Found (organization or product not found)
- `500` - Internal Server Error

Error responses include a descriptive message:

```json
{
  "error": "Organization not found"
}
``` 