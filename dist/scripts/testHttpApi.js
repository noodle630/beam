#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testHttpApi = testHttpApi;
require("dotenv/config");
async function detectPort() {
    const ports = [3000, 3001, 3002];
    for (const port of ports) {
        try {
            const response = await fetch(`http://localhost:${port}/api/tools/find-products`, {
                method: 'POST',
                headers: {
                    'x-beam-api-key': 'dev-test-key',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    shop_domain: 'beam-devtest.myshopify.com',
                    query: 'snowboard',
                    limit: 1
                })
            });
            if (response.ok) {
                const data = await response.json();
                if (data && Array.isArray(data) && data.length > 0) {
                    return port;
                }
            }
        }
        catch (e) {
        }
    }
    throw new Error('No working HTTP API server found on ports 3000-3002');
}
async function testHttpApi() {
    console.log('🌐 Testing HTTP Actions API...');
    try {
        const port = await detectPort();
        console.log(`✅ Found working server on port ${port}`);
        console.log('🔍 Testing find-products...');
        const response = await fetch(`http://localhost:${port}/api/tools/find-products`, {
            method: 'POST',
            headers: {
                'x-beam-api-key': 'dev-test-key',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                shop_domain: 'beam-devtest.myshopify.com',
                query: 'snowboard',
                limit: 3
            })
        });
        if (response.ok) {
            const products = await response.json();
            console.log(`✅ Found ${products.length} products`);
            if (products.length > 0) {
                console.log('📋 Testing get-product-details...');
                const detailsResponse = await fetch(`http://localhost:${port}/api/tools/get-product-details`, {
                    method: 'POST',
                    headers: {
                        'x-beam-api-key': 'dev-test-key',
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        product_id: products[0].product_id,
                        shop_domain: 'beam-devtest.myshopify.com'
                    })
                });
                if (detailsResponse.ok) {
                    const details = await detailsResponse.json();
                    console.log(`✅ Product details: ${details.title}`);
                    console.log('🛒 Testing create-checkout-link...');
                    const checkoutResponse = await fetch(`http://localhost:${port}/api/tools/create-checkout-link`, {
                        method: 'POST',
                        headers: {
                            'x-beam-api-key': 'dev-test-key',
                            'content-type': 'application/json'
                        },
                        body: JSON.stringify({
                            product_id: products[0].product_id,
                            shop_domain: 'beam-devtest.myshopify.com',
                            qty: 2
                        })
                    });
                    if (checkoutResponse.ok) {
                        const checkout = await checkoutResponse.json();
                        console.log(`✅ Checkout link: ${checkout.checkout_url}`);
                        console.log('');
                        console.log('🎉 All HTTP API tests passed!');
                        return true;
                    }
                    else {
                        console.log('❌ Checkout link test failed');
                    }
                }
                else {
                    console.log('❌ Product details test failed');
                }
            }
        }
        else {
            console.log('❌ Find products test failed');
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('❌ HTTP API test failed:', errorMessage);
        return false;
    }
    return false;
}
if (require.main === module) {
    testHttpApi().then(success => {
        process.exit(success ? 0 : 1);
    });
}
