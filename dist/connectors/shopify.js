"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrgSlugFromDomain = getOrgSlugFromDomain;
exports.syncShopifyCatalog = syncShopifyCatalog;
exports.createShopifyCheckoutLink = createShopifyCheckoutLink;
const supaAdmin_1 = require("../lib/supaAdmin");
const upsertProduct_1 = require("../lib/upsertProduct");
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    require('dotenv/config');
}
function getOrgSlugFromDomain(shopDomain) {
    return shopDomain.replace('.myshopify.com', '');
}
async function ensureOrganizationExists(orgSlug, shopDomain) {
    const { data: existingOrg } = await supaAdmin_1.supabaseAdmin
        .from('organizations')
        .select('slug')
        .eq('slug', orgSlug)
        .single();
    if (!existingOrg) {
        const { error } = await supaAdmin_1.supabaseAdmin
            .from('organizations')
            .insert({
            slug: orgSlug,
            name: `${orgSlug} (Shopify Store)`,
            created_at: new Date().toISOString()
        });
        if (error) {
            console.error(`❌ Failed to create organization ${orgSlug}:`, error);
            throw new Error(`Failed to create organization: ${error.message}`);
        }
        console.log(`✅ Created organization: ${orgSlug}`);
    }
}
async function shopifyGraphQL(config, query, variables = {}) {
    const url = `https://${config.shopDomain}/admin/api/${config.apiVersion}/graphql.json`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': config.adminToken
        },
        body: JSON.stringify({
            query,
            variables
        })
    });
    if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }
    const result = await response.json();
    if (result.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }
    return result.data;
}
async function getShopMeta(config) {
    const query = `
    query ShopMeta {
      shop {
        currencyCode
      }
    }
  `;
    return shopifyGraphQL(config, query);
}
async function* fetchAllProducts(config) {
    const query = `
    query Products($cursor: String) {
      products(first: 100, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          vendor
          productType
          handle
          tags
          status
          bodyHtml
          images(first: 50) {
            nodes {
              url: originalSrc
            }
          }
          variants(first: 100) {
            nodes {
              id
              title
              sku
              price
              availableForSale
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
    }
  `;
    let cursor = null;
    let hasNextPage = true;
    while (hasNextPage) {
        const variables = cursor ? { cursor } : {};
        const result = await shopifyGraphQL(config, query, variables);
        yield result.products.nodes;
        hasNextPage = result.products.pageInfo.hasNextPage;
        cursor = result.products.pageInfo.endCursor;
        if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }
}
function normalizeShopifyProduct(product, orgSlug, shopDomain, shopCurrency) {
    const totalQuantity = product.variants.nodes.reduce((sum, variant) => {
        return sum + (variant.inventoryQuantity || 0);
    }, 0);
    const imageUrls = product.images.nodes.map(img => img.url);
    const firstVariant = product.variants.nodes[0];
    const isSingleVariant = product.variants.nodes.length === 1;
    const variants = product.variants.nodes.map(variant => ({
        id: variant.id,
        sku: variant.sku || '',
        title: variant.title,
        price: Number(variant.price) || 0,
        available: variant.availableForSale,
        quantity: variant.inventoryQuantity ?? null,
        options: Object.fromEntries(variant.selectedOptions.map(option => [
            option.name.toLowerCase(),
            option.value
        ]))
    }));
    const normalized = {
        org_slug: orgSlug,
        title: product.title,
        brand: product.vendor || undefined,
        category: product.productType || undefined,
        price: firstVariant ? Number(firstVariant.price) || undefined : undefined,
        currency: shopCurrency,
        quantity: totalQuantity > 0 ? totalQuantity : undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
        sku: isSingleVariant ? firstVariant?.sku || undefined : undefined,
        merchant_product_id: product.id,
        merchant_variant_id: isSingleVariant ? firstVariant?.id : undefined,
        attributes: {
            description_html: product.bodyHtml || '',
            handle: product.handle,
            shop_domain: shopDomain,
            variants,
            pdp_url: `https://${shopDomain}/products/${product.handle}`,
            tags: product.tags,
            status: product.status,
            vendor: product.vendor
        },
        source: 'shopify',
        source_updated_at: new Date().toISOString()
    };
    return normalized;
}
async function syncShopifyCatalog(config) {
    console.log(`🚀 Starting Shopify sync for ${config.shopDomain}`);
    const orgSlug = getOrgSlugFromDomain(config.shopDomain);
    await ensureOrganizationExists(orgSlug, config.shopDomain);
    const shopMeta = await getShopMeta(config);
    console.log(`💰 Shop currency: ${shopMeta.currency}`);
    console.log(`🏢 Organization: ${orgSlug}`);
    const summary = {
        org_slug: orgSlug,
        seen: 0,
        inserted: 0,
        updated: 0,
        unchanged: 0,
        errors: 0,
        error_details: []
    };
    for await (const productBatch of fetchAllProducts(config)) {
        console.log(`📦 Processing batch of ${productBatch.length} products...`);
        const normalizedProducts = productBatch.map(product => normalizeShopifyProduct(product, orgSlug, config.shopDomain, shopMeta.currency));
        const batchSummary = await (0, upsertProduct_1.batchUpsertProducts)(normalizedProducts);
        summary.seen += batchSummary.seen;
        summary.inserted += batchSummary.inserted;
        summary.updated += batchSummary.updated;
        summary.unchanged += batchSummary.unchanged;
        summary.errors += batchSummary.errors;
        if (summary.error_details) {
            summary.error_details.push(...batchSummary.error_details);
        }
        else {
            summary.error_details = [...batchSummary.error_details];
        }
        console.log(`📊 Progress: ${summary.seen} seen, ${summary.inserted} inserted, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.errors} errors`);
    }
    console.log('✅ Shopify sync completed');
    console.log(`📈 Summary: ${summary.seen} products processed`);
    console.log(`   📥 ${summary.inserted} inserted`);
    console.log(`   🔄 ${summary.updated} updated`);
    console.log(`   ⏹️  ${summary.unchanged} unchanged`);
    console.log(`   ❌ ${summary.errors} errors`);
    return summary;
}
function createShopifyCheckoutLink(params) {
    const { shopDomain, variantId, qty = 1 } = params;
    return `https://${shopDomain}/cart/${variantId}:${qty}`;
}
