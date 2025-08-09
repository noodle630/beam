"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateOrgIdentifier = validateOrgIdentifier;
exports.validateProductId = validateProductId;
exports.validateFindProductsParams = validateFindProductsParams;
exports.findProducts = findProducts;
exports.getProductDetails = getProductDetails;
exports.createCheckoutLink = createCheckoutLink;
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    require('dotenv/config');
}
const supaAdmin_1 = require("./supaAdmin");
const shopify_1 = require("../connectors/shopify");
function validateOrgIdentifier(params) {
    if (params.org_slug && params.shop_domain) {
        throw new Error('Provide either org_slug or shop_domain, not both');
    }
    if (params.org_slug) {
        if (typeof params.org_slug !== 'string' || params.org_slug.trim().length === 0) {
            throw new Error('org_slug must be a non-empty string');
        }
        return params.org_slug.trim();
    }
    if (params.shop_domain) {
        if (typeof params.shop_domain !== 'string' || params.shop_domain.trim().length === 0) {
            throw new Error('shop_domain must be a non-empty string');
        }
        return (0, shopify_1.getOrgSlugFromDomain)(params.shop_domain.trim());
    }
    throw new Error('Either org_slug or shop_domain is required');
}
function validateProductId(productId) {
    if (typeof productId !== 'string' || productId.trim().length === 0) {
        throw new Error('product_id must be a non-empty string');
    }
    return productId.trim();
}
function validateFindProductsParams(params) {
    const orgSlug = validateOrgIdentifier(params);
    const validated = {
        org_slug: orgSlug
    };
    if (params.query !== undefined) {
        if (typeof params.query !== 'string') {
            throw new Error('query must be a string');
        }
        validated.query = params.query;
    }
    if (params.brand !== undefined) {
        if (typeof params.brand === 'string') {
            if (params.brand.includes(',')) {
                validated.brand = params.brand.split(',').map((b) => b.trim()).filter((b) => b.length > 0);
            }
            else {
                validated.brand = params.brand;
            }
        }
        else if (Array.isArray(params.brand)) {
            validated.brand = params.brand;
        }
        else {
            throw new Error('brand must be a string or array of strings');
        }
    }
    if (params.category !== undefined) {
        if (typeof params.category === 'string') {
            if (params.category.includes(',')) {
                validated.category = params.category.split(',').map((c) => c.trim()).filter((c) => c.length > 0);
            }
            else {
                validated.category = params.category;
            }
        }
        else if (Array.isArray(params.category)) {
            validated.category = params.category;
        }
        else {
            throw new Error('category must be a string or array of strings');
        }
    }
    if (params.condition !== undefined) {
        if (typeof params.condition === 'string') {
            if (params.condition.includes(',')) {
                validated.condition = params.condition.split(',').map((c) => c.trim()).filter((c) => c.length > 0);
            }
            else {
                validated.condition = params.condition;
            }
        }
        else if (Array.isArray(params.condition)) {
            validated.condition = params.condition;
        }
        else {
            throw new Error('condition must be a string or array of strings');
        }
    }
    if (params.price_min !== undefined) {
        const priceMin = Number(params.price_min);
        if (isNaN(priceMin) || priceMin < 0) {
            throw new Error('price_min must be a non-negative number');
        }
        validated.price_min = priceMin;
    }
    if (params.price_max !== undefined) {
        const priceMax = Number(params.price_max);
        if (isNaN(priceMax) || priceMax < 0) {
            throw new Error('price_max must be a non-negative number');
        }
        validated.price_max = priceMax;
    }
    if (params.attributes !== undefined) {
        if (typeof params.attributes !== 'object' || params.attributes === null) {
            throw new Error('attributes must be an object');
        }
        validated.attributes = params.attributes;
    }
    if (params.limit !== undefined) {
        const limit = Number(params.limit);
        if (isNaN(limit) || limit < 1 || limit > 100) {
            throw new Error('limit must be a number between 1 and 100');
        }
        validated.limit = limit;
    }
    else {
        validated.limit = 20;
    }
    return validated;
}
async function findProducts(params) {
    (0, supaAdmin_1.debugLog)('Finding products with params:', params);
    const orgSlug = validateOrgIdentifier(params);
    let query = supaAdmin_1.supabaseAdmin
        .from('products')
        .select('id, title, brand, category, price, currency, image_urls, sku, source, merchant_product_id, updated_at')
        .eq('org_slug', orgSlug);
    if (params.query) {
        query = query.or(`title.ilike.%${params.query}%, brand.ilike.%${params.query}%, category.ilike.%${params.query}%`);
    }
    if (params.brand) {
        const brands = Array.isArray(params.brand) ? params.brand : [params.brand];
        query = query.in('brand', brands);
    }
    if (params.category) {
        const categories = Array.isArray(params.category) ? params.category : [params.category];
        query = query.in('category', categories);
    }
    if (params.condition) {
        const conditions = Array.isArray(params.condition) ? params.condition : [params.condition];
        query = query.in('condition', conditions);
    }
    if (params.price_min !== undefined) {
        query = query.gte('price', params.price_min);
    }
    if (params.price_max !== undefined) {
        query = query.lte('price', params.price_max);
    }
    if (params.attributes) {
        for (const [key, value] of Object.entries(params.attributes)) {
            query = query.contains('attributes', { [key]: value });
        }
    }
    if (params.limit) {
        query = query.limit(params.limit);
    }
    query = query.order('updated_at', { ascending: false });
    const { data, error } = await query;
    if (error) {
        throw new Error(`Database query failed: ${error.message}`);
    }
    if (!data) {
        return [];
    }
    const deduplicatedData = data.reduce((acc, product) => {
        if (product.source === 'shopify' && product.merchant_product_id) {
            const existing = acc.find(p => p.source === 'shopify' &&
                p.merchant_product_id === product.merchant_product_id);
            if (!existing) {
                acc.push(product);
            }
        }
        else {
            acc.push(product);
        }
        return acc;
    }, []);
    const results = deduplicatedData.map(product => ({
        product_id: product.id,
        title: product.title || 'Untitled Product',
        brand: product.brand || undefined,
        category: product.category || undefined,
        price: product.price || undefined,
        currency: product.currency || undefined,
        image: Array.isArray(product.image_urls) && product.image_urls.length > 0
            ? product.image_urls[0]
            : null,
        url: null
    }));
    (0, supaAdmin_1.debugLog)('Found products:', results.length);
    return results;
}
async function getProductDetails(productId, orgSlug) {
    (0, supaAdmin_1.debugLog)('Getting product details:', { productId, orgSlug });
    const { data, error } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('org_slug', orgSlug)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            throw new Error('Product not found');
        }
        throw new Error(`Database query failed: ${error.message}`);
    }
    (0, supaAdmin_1.debugLog)('Product details retrieved');
    return {
        product_id: data.id,
        title: data.title || 'Untitled Product',
        brand: data.brand || undefined,
        category: data.category || undefined,
        price: data.price || undefined,
        currency: data.currency || undefined,
        quantity: data.quantity || undefined,
        image_urls: data.image_urls || undefined,
        sku: data.sku || undefined,
        attributes: data.attributes || undefined,
        source: data.source || undefined
    };
}
async function createCheckoutLink(productId, orgSlug, variant, qty = 1, shopDomain) {
    (0, supaAdmin_1.debugLog)('Creating checkout link:', { productId, orgSlug, variant, qty, shopDomain });
    const { data, error } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .select('source, attributes')
        .eq('id', productId)
        .eq('org_slug', orgSlug)
        .single();
    if (error) {
        if (error.code === 'PGRST116') {
            throw new Error('Product not found');
        }
        throw new Error(`Database query failed: ${error.message}`);
    }
    if (data.source === 'shopify') {
        let effectiveShopDomain = shopDomain;
        if (!effectiveShopDomain) {
            effectiveShopDomain = data.attributes?.shop_domain;
        }
        if (!effectiveShopDomain) {
            throw new Error('shop_domain is required for Shopify products when not stored in product attributes');
        }
        let variantId = variant;
        if (!variantId) {
            const variants = data.attributes?.variants;
            if (variants && Array.isArray(variants) && variants.length > 0) {
                variantId = variants[0].id;
            }
        }
        if (variantId) {
            const checkoutUrl = (0, shopify_1.createShopifyCheckoutLink)({ shopDomain: effectiveShopDomain, variantId, qty });
            (0, supaAdmin_1.debugLog)('Shopify checkout link created:', { checkoutUrl });
            return { checkout_url: checkoutUrl };
        }
    }
    const pdpUrl = data.attributes?.pdp_url || data.attributes?.['pdp url'];
    (0, supaAdmin_1.debugLog)('Checkout link result (fallback):', { pdpUrl });
    return { checkout_url: pdpUrl || null };
}
