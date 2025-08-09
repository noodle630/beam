#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const shopify_1 = require("../connectors/shopify");
async function main() {
    console.log('🚀 Beam Shopify Sync Tool');
    console.log('========================');
    const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;
    const apiVersion = process.env.SHOPIFY_API_VERSION;
    const missing = [];
    if (!shopDomain)
        missing.push('SHOPIFY_SHOP_DOMAIN');
    if (!adminToken)
        missing.push('SHOPIFY_ADMIN_TOKEN');
    if (!apiVersion)
        missing.push('SHOPIFY_API_VERSION');
    if (missing.length > 0) {
        console.error('❌ Missing required environment variables:');
        missing.forEach(env => console.error(`   ${env}`));
        console.error('');
        console.error('💡 Please set these in your .env file:');
        console.error('   SHOPIFY_SHOP_DOMAIN=your-store.myshopify.com');
        console.error('   SHOPIFY_ADMIN_TOKEN=your-admin-access-token');
        console.error('   SHOPIFY_API_VERSION=2023-10');
        console.error('');
        console.error('📚 For more info, see: https://shopify.dev/docs/api/admin-graphql');
        process.exit(1);
    }
    const validatedConfig = {
        shopDomain: shopDomain,
        adminToken: adminToken,
        apiVersion: apiVersion
    };
    console.log(`🏪 Shop Domain: ${validatedConfig.shopDomain}`);
    console.log(`🔑 API Version: ${validatedConfig.apiVersion}`);
    console.log(`🔐 Token: ${validatedConfig.adminToken.substring(0, 8)}...`);
    console.log('');
    try {
        const startTime = Date.now();
        const summary = await (0, shopify_1.syncShopifyCatalog)(validatedConfig);
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log('');
        console.log('🎉 Sync completed successfully!');
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log('');
        console.log('📊 Final Summary:');
        console.log(`   🏢 Organization: ${summary.org_slug}`);
        console.log(`   👀 Products seen: ${summary.seen}`);
        console.log(`   ➕ Products inserted: ${summary.inserted}`);
        console.log(`   🔄 Products updated: ${summary.updated}`);
        console.log(`   ❌ Errors: ${summary.errors}`);
        if (summary.errors > 0 && summary.error_details) {
            console.log('');
            console.log('🔍 Error Details (first 10):');
            summary.error_details.forEach((error, index) => {
                console.log(`   ${index + 1}. Product ${error.product_id}: ${error.error}`);
            });
        }
        console.log('');
        console.log('✅ All done! Your Shopify products are now available in Beam.');
        console.log(`🔗 Test with: curl "http://localhost:3000/org/${summary.org_slug}"`);
    }
    catch (error) {
        console.error('');
        console.error('❌ Sync failed:');
        if (error instanceof Error) {
            console.error(`   ${error.message}`);
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                console.error('');
                console.error('💡 This looks like an authentication error.');
                console.error('   Check that your SHOPIFY_ADMIN_TOKEN is correct and has the right permissions.');
            }
            else if (error.message.includes('404') || error.message.includes('Not Found')) {
                console.error('');
                console.error('💡 This looks like a domain or API version error.');
                console.error('   Check that SHOPIFY_SHOP_DOMAIN and SHOPIFY_API_VERSION are correct.');
            }
            else if (error.message.includes('rate limit') || error.message.includes('429')) {
                console.error('');
                console.error('💡 Rate limit hit. The script includes automatic delays, but you may need to wait.');
                console.error('   Try running again in a few minutes.');
            }
        }
        else {
            console.error('   Unknown error occurred');
        }
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   1. Verify your Shopify Admin API credentials');
        console.error('   2. Check that your store domain is correct');
        console.error('   3. Ensure your access token has "read_products" permission');
        console.error('   4. Try with DEBUG_SHOPIFY=1 for more detailed logs');
        process.exit(1);
    }
}
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}
