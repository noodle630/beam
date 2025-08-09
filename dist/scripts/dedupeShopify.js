#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supaAdmin_1 = require("../lib/supaAdmin");
async function findDuplicateGroups() {
    const { data, error } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .select('org_slug, merchant_product_id')
        .eq('source', 'shopify');
    if (error) {
        throw new Error(`Failed to query products: ${error.message}`);
    }
    const groups = new Map();
    for (const row of data) {
        const key = `${row.org_slug}:${row.merchant_product_id}`;
        groups.set(key, (groups.get(key) || 0) + 1);
    }
    const duplicates = [];
    for (const [key, count] of groups.entries()) {
        if (count > 1) {
            const [org_slug, merchant_product_id] = key.split(':');
            duplicates.push({ org_slug, merchant_product_id, duplicate_count: count });
        }
    }
    return duplicates.sort((a, b) => b.duplicate_count - a.duplicate_count);
}
async function getProductsInGroup(org_slug, merchant_product_id) {
    const { data, error } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .select('*')
        .eq('org_slug', org_slug)
        .eq('merchant_product_id', merchant_product_id)
        .eq('source', 'shopify')
        .order('updated_at', { ascending: false });
    if (error) {
        throw new Error(`Failed to query products for group: ${error.message}`);
    }
    return data;
}
function mergeProducts(products) {
    if (products.length === 0) {
        throw new Error('Cannot merge empty product list');
    }
    const survivor = { ...products[0] };
    const allImageUrls = new Set();
    const allVariants = new Map();
    for (const product of products) {
        if (product.image_urls && Array.isArray(product.image_urls)) {
            for (const url of product.image_urls) {
                if (url && typeof url === 'string') {
                    allImageUrls.add(url);
                }
            }
        }
        if (product.attributes?.variants && Array.isArray(product.attributes.variants)) {
            for (const variant of product.attributes.variants) {
                if (variant?.id) {
                    allVariants.set(variant.id, variant);
                }
            }
        }
        if (product.attributes && typeof product.attributes === 'object') {
            survivor.attributes = {
                ...product.attributes,
                ...survivor.attributes,
            };
        }
    }
    survivor.image_urls = Array.from(allImageUrls).sort();
    if (survivor.attributes) {
        survivor.attributes.variants = Array.from(allVariants.values());
    }
    return survivor;
}
async function dedupeGroup(group) {
    console.log(`🔄 Processing group: ${group.org_slug}:${group.merchant_product_id} (${group.duplicate_count} duplicates)`);
    const products = await getProductsInGroup(group.org_slug, group.merchant_product_id);
    if (products.length <= 1) {
        console.log(`   ✅ No action needed (${products.length} products found)`);
        return;
    }
    const mergedProduct = mergeProducts(products);
    const survivorId = mergedProduct.id;
    const loserIds = products.slice(1).map(p => p.id);
    console.log(`   🎯 Survivor: ${survivorId}`);
    console.log(`   🗑️  Will delete: ${loserIds.join(', ')}`);
    const updateData = {
        title: mergedProduct.title,
        brand: mergedProduct.brand,
        category: mergedProduct.category,
        price: mergedProduct.price,
        currency: mergedProduct.currency,
        quantity: mergedProduct.quantity,
        sku: mergedProduct.sku,
        image_urls: mergedProduct.image_urls,
        attributes: mergedProduct.attributes,
        updated_at: new Date().toISOString()
    };
    const { error: updateError } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .update(updateData)
        .eq('id', survivorId);
    if (updateError) {
        throw new Error(`Failed to update survivor ${survivorId}: ${updateError.message}`);
    }
    const { error: deleteError } = await supaAdmin_1.supabaseAdmin
        .from('products')
        .delete()
        .in('id', loserIds);
    if (deleteError) {
        throw new Error(`Failed to delete losers: ${deleteError.message}`);
    }
    console.log(`   ✅ Merged ${products.length} → 1, deleted ${loserIds.length} duplicates`);
}
async function main() {
    console.log('🚀 Beam Shopify Deduplication Tool');
    console.log('==================================');
    try {
        console.log('🔍 Scanning for duplicate Shopify products...');
        const duplicateGroups = await findDuplicateGroups();
        if (duplicateGroups.length === 0) {
            console.log('✅ No duplicates found! Your database is clean.');
            return;
        }
        console.log(`⚠️  Found ${duplicateGroups.length} groups with duplicates:`);
        for (const group of duplicateGroups) {
            console.log(`   ${group.org_slug}:${group.merchant_product_id} → ${group.duplicate_count} copies`);
        }
        console.log('');
        let totalDuplicatesRemoved = 0;
        for (const group of duplicateGroups) {
            await dedupeGroup(group);
            totalDuplicatesRemoved += group.duplicate_count - 1;
        }
        console.log('');
        console.log('🎉 Deduplication completed!');
        console.log(`📊 Summary:`);
        console.log(`   🔍 Groups processed: ${duplicateGroups.length}`);
        console.log(`   🗑️  Duplicates removed: ${totalDuplicatesRemoved}`);
        console.log('');
        console.log('✅ Your database is now clean and ready for proper syncing!');
    }
    catch (error) {
        console.error('');
        console.error('❌ Deduplication failed:');
        if (error instanceof Error) {
            console.error(`   ${error.message}`);
        }
        else {
            console.error('   Unknown error occurred');
        }
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   1. Ensure your Supabase service role key is correct');
        console.error('   2. Check that the products table exists and has the right structure');
        console.error('   3. Make sure you have the necessary permissions');
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}
