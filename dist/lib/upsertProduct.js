"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertProduct = upsertProduct;
exports.batchUpsertProducts = batchUpsertProducts;
const supaAdmin_1 = require("./supaAdmin");
const crypto_1 = require("crypto");
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    require('dotenv/config');
}
function createProductHash(product) {
    const hashData = {
        title: product.title || null,
        brand: product.brand || null,
        category: product.category || null,
        price: product.price || null,
        currency: product.currency || null,
        quantity: product.quantity || null,
        sku: product.sku || null,
        image_urls: product.image_urls ? [...product.image_urls].sort() : null,
        attributes: product.attributes ? JSON.parse(JSON.stringify(product.attributes, Object.keys(product.attributes).sort())) : null
    };
    const dataString = JSON.stringify(hashData);
    return (0, crypto_1.createHash)('sha1').update(dataString).digest('hex');
}
async function upsertProduct(product) {
    const currentHash = createProductHash(product);
    const productWithHash = {
        ...product,
        attributes: {
            ...product.attributes,
            _sync_hash: currentHash
        },
        updated_at: new Date().toISOString()
    };
    let matchConditions;
    let conflictColumns;
    if (product.source === 'shopify') {
        matchConditions = {
            org_slug: product.org_slug,
            merchant_product_id: product.merchant_product_id,
            source: 'shopify'
        };
        conflictColumns = ['org_slug', 'merchant_product_id'];
    }
    else {
        if (product.merchant_product_id && product.merchant_variant_id) {
            matchConditions = {
                org_slug: product.org_slug,
                merchant_product_id: product.merchant_product_id,
                merchant_variant_id: product.merchant_variant_id
            };
            conflictColumns = ['org_slug', 'merchant_product_id', 'merchant_variant_id'];
        }
        else if (product.sku) {
            matchConditions = {
                org_slug: product.org_slug,
                sku: product.sku
            };
            conflictColumns = ['org_slug', 'sku'];
        }
        else {
            const { data, error } = await supaAdmin_1.supabaseAdmin
                .from('products')
                .insert(productWithHash)
                .select('id')
                .single();
            if (error) {
                throw new Error(`Failed to insert product: ${error.message}`);
            }
            return {
                action: 'inserted',
                productId: data.id
            };
        }
    }
    const { data: existingProducts, error: selectError } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .select('id, attributes, updated_at')
        .match(matchConditions);
    if (selectError) {
        throw new Error(`Failed to query existing products: ${selectError.message}`);
    }
    if (existingProducts && existingProducts.length > 0) {
        const existingProduct = existingProducts[0];
        const existingHash = existingProduct.attributes?._sync_hash;
        if (existingHash === currentHash) {
            return {
                action: 'unchanged',
                productId: existingProduct.id,
                matchedOn: conflictColumns.join('+')
            };
        }
        const mergedAttributes = {
            ...existingProduct.attributes,
            ...productWithHash.attributes
        };
        const updateData = {
            ...productWithHash,
            attributes: mergedAttributes
        };
        const { data: updatedProduct, error: updateError } = await supaAdmin_1.supabaseAdmin
            .from('products')
            .update(updateData)
            .eq('id', existingProduct.id)
            .select('id')
            .single();
        if (updateError) {
            throw new Error(`Failed to update product: ${updateError.message}`);
        }
        return {
            action: 'updated',
            productId: updatedProduct.id,
            matchedOn: conflictColumns.join('+')
        };
    }
    else {
        if (!productWithHash.title && productWithHash.attributes) {
            const firstAttrValue = Object.values(productWithHash.attributes)[0];
            if (typeof firstAttrValue === 'string') {
                productWithHash.title = firstAttrValue;
            }
        }
        const { data: newProduct, error: insertError } = await supaAdmin_1.supabaseAdmin
            .from('products')
            .insert(productWithHash)
            .select('id')
            .single();
        if (insertError) {
            throw new Error(`Failed to insert product: ${insertError.message}`);
        }
        return {
            action: 'inserted',
            productId: newProduct.id
        };
    }
}
async function batchUpsertProducts(products) {
    const summary = {
        seen: products.length,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        errors: 0,
        error_details: []
    };
    for (const product of products) {
        try {
            const result = await upsertProduct(product);
            if (result.action === 'inserted') {
                summary.inserted++;
                console.log(`✅ Inserted new product ${result.productId}`);
            }
            else if (result.action === 'updated') {
                summary.updated++;
                console.log(`✅ Updated product ${result.productId} (matched on ${result.matchedOn})`);
            }
            else if (result.action === 'unchanged') {
                summary.unchanged++;
                console.log(`⏹️  No changes for product ${result.productId} (matched on ${result.matchedOn})`);
            }
        }
        catch (error) {
            summary.errors++;
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const productId = product.merchant_product_id || product.sku || 'unknown';
            summary.error_details.push({
                product_id: productId,
                error: errorMessage
            });
            console.error('Error inserting product:', error);
            console.error(`❌ Failed to upsert product ${product.title || productId}: ${errorMessage}`);
        }
    }
    return summary;
}
