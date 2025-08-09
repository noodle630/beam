# CSV Ingestion System

## Overview

The CSV ingestion system provides a flexible mapping layer to import product data from CSV files into the Beam platform with intelligent header normalization and automatic field mapping.

## Header Normalization

The system automatically normalizes CSV headers for case-insensitive matching:

1. **Remove BOM** (Byte Order Mark) characters
2. **Trim outer spaces** 
3. **Collapse internal whitespace** to single spaces
4. **Case-insensitive comparison** when matching to mapping rules

### Examples

| Original Header | Normalized | Matches Rule |
|----------------|------------|--------------|
| ` Product Name ` | `product name` | `Product Name` |
| `BRAND` | `brand` | `Brand` |
| `  Price  $  ` | `price $` | `Price` (partial match) |

## Field Assignment Logic

### Core Fields

These fields are assigned directly to the product object:
- `title`, `description`, `brand`, `category`, `price`, `currency`
- `quantity`, `image_urls`, `sku`, `condition`
- `global_id_type`, `global_id_value`, `merchant_product_id`, `merchant_variant_id`

### Attributes Catch-All

Fields that don't match core mappings go to the `attributes` JSONB column:

1. **Mapped to attributes.*** - If mapping rule specifies `attributes.custom_field`
2. **Unmapped fields** - Original CSV headers become attribute keys (cleaned)
3. **Automatic type coercion** - Numeric strings become numbers

### Key Cleaning for Attributes

Unmapped field names are cleaned for attribute keys:
- `Custom-Field!` → `custom_field_`
- `Another@Field` → `another_field`
- `PDP URL` → `pdp_url`

## Transform Operations

Transforms are applied in deterministic order:

1. **trim** - Remove whitespace
2. **lower/upper** - Case conversion  
3. **regex** - Pattern extraction
4. **split/join** - Array operations
5. **to_number** - Numeric conversion

### Special Handling

#### Image URLs
Always outputs an array, regardless of input format:
```csv
Images
"img1.jpg,img2.jpg"     → ["img1.jpg", "img2.jpg"]
"img1.jpg|img2.jpg"     → ["img1.jpg", "img2.jpg"] 
"single-image.jpg"      → ["single-image.jpg"]
```

#### Condition Values
Normalized to enum values:
- `new`, `brand new` → `new`
- `used`, `pre-owned` → `used`  
- `refurbished`, `renewed` → `refurbished`
- `open box`, `open-box` → `open_box`
- Everything else → `other`

## Database Schema Updates

Add these tables to your Supabase project:

```sql
-- Add missing columns to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS condition TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS quantity INTEGER,
ADD COLUMN IF NOT EXISTS image_urls TEXT[],
ADD COLUMN IF NOT EXISTS global_id_type TEXT,
ADD COLUMN IF NOT EXISTS global_id_value TEXT,
ADD COLUMN IF NOT EXISTS merchant_product_id TEXT,
ADD COLUMN IF NOT EXISTS merchant_variant_id TEXT,
ADD COLUMN IF NOT EXISTS attributes JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS source_updated_at TIMESTAMPTZ;

-- Create field_mappings table if it doesn't exist
CREATE TABLE IF NOT EXISTS field_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_slug TEXT NOT NULL REFERENCES organizations(slug),
  source TEXT NOT NULL DEFAULT 'csv',
  source_field TEXT NOT NULL,
  internal_field TEXT NOT NULL,
  transform_spec JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_slug, source, source_field)
);

-- Update ingestion_jobs table
ALTER TABLE ingestion_jobs
ADD COLUMN IF NOT EXISTS filename TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'csv',
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_merchant_ids ON products(org_slug, merchant_product_id, merchant_variant_id);
CREATE INDEX IF NOT EXISTS idx_products_sku_org ON products(org_slug, sku);
CREATE INDEX IF NOT EXISTS idx_field_mappings_org_source ON field_mappings(org_slug, source);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_org ON ingestion_jobs(org_slug);
```

## API Usage

### Basic CSV Upload

```bash
curl -X POST http://localhost:3000/api/ingest-csv \
  -F "file=@products.csv" \
  -F "org_slug=demo-brand"
```

### Response Format

```json
{
  "success": true,
  "job_id": "uuid-here",
  "status": "success",
  "summary": {
    "rows_seen": 10,
    "rows_processed": 10,
    "rows_inserted": 8,
    "rows_updated": 2,
    "mapping_errors": 0,
    "upsert_errors": 0,
    "total_errors": 0
  }
}
```

## Mapping System

### Default Mappings

The system includes default mappings for common CSV headers:

| CSV Header | Internal Field | Transform |
|------------|----------------|-----------|
| Product Name | title | - |
| MSRP | price | to_number |
| Images | image_urls | split by \| |
| SKU | sku | - |
| Brand | brand | - |
| Quantity | quantity | to_number |

### Custom Mappings

Add custom mappings to the `field_mappings` table:

```sql
INSERT INTO field_mappings (org_slug, source, source_field, internal_field, transform_spec) VALUES
('demo-brand', 'csv', 'Product Title', 'title', NULL),
('demo-brand', 'csv', 'Retail Price', 'price', '{"op": "to_number"}'),
('demo-brand', 'csv', 'Photo URLs', 'image_urls', '{"op": "split", "args": {"delimiter": "|"}}');
```

## Product Upsert Logic

Products are upserted with this key priority:

1. **Primary**: `(org_slug, merchant_product_id, merchant_variant_id)` if both IDs present
2. **Secondary**: `(org_slug, sku)` if SKU present
3. **Fallback**: Insert as new product

### Attribute Merging

- Core fields (title, price, etc.) are always overwritten
- `attributes` JSONB field is merged shallowly
- Existing attribute keys are overwritten by new values
- New attribute keys are added

## Job Lifecycle

### Status Values
- `running` - Currently processing
- `success` - Completed without errors
- `error` - Completed with errors
- `failed` - Job failed completely

### Metrics Tracking
Jobs track detailed metrics in the `metadata` JSONB field:
```json
{
  "rows_seen": 100,
  "rows_processed": 98,
  "rows_inserted": 50,
  "rows_updated": 48,
  "mapping_errors": 2,
  "upsert_errors": 0,
  "total_errors": 2
}
```

## Testing Examples

### Basic Mapping Test

CSV Input:
```csv
Product Name,MSRP,SKU,Images,Custom Field
Widget Pro,29.99,WID-001,"img1.jpg|img2.jpg",Special Value
```

Expected Output:
```json
{
  "org_slug": "demo-brand",
  "title": "Widget Pro",
  "price": 29.99,
  "sku": "WID-001",
  "image_urls": ["img1.jpg", "img2.jpg"],
  "attributes": {
    "custom_field": "Special Value"
  },
  "source": "csv"
}
```

### Header Normalization Test

CSV with messy headers:
```csv
" Product Name ",BRAND,  PRICE  
"Test Product","TestBrand","29.99"
```

All headers are normalized and matched case-insensitively to mapping rules.

## Error Handling

The system tracks errors at multiple levels:

1. **Mapping Errors**: When CSV row cannot be mapped to product
2. **Upsert Errors**: When database operation fails
3. **Job Errors**: When entire ingestion fails

All errors are logged in the `ingestion_jobs.metadata` field for debugging.

## Performance Considerations

- Products are upserted one by one (not batch) to handle complex matching logic
- Consider adding database indexes for your specific query patterns
- Large CSV files (>1000 rows) may take several seconds to process
- Monitor `ingestion_jobs` table for job status and performance metrics
- Use `DEBUG_INGEST=1` environment variable for detailed logging during development 