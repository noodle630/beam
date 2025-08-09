#!/usr/bin/env ts-node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
class MCPClient {
    constructor(serverPath) {
        this.requestId = 1;
        this.pendingRequests = new Map();
        this.process = (0, child_process_1.spawn)('node', [serverPath], {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        this.process.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const response = JSON.parse(line);
                    if (response.id && this.pendingRequests.has(response.id)) {
                        const { resolve, reject } = this.pendingRequests.get(response.id);
                        this.pendingRequests.delete(response.id);
                        if (response.error) {
                            reject(new Error(response.error.message || 'MCP Error'));
                        }
                        else {
                            resolve(response.result);
                        }
                    }
                }
                catch (e) {
                }
            }
        });
        this.process.stderr.on('data', (data) => {
            if (process.env.DEBUG_MCP_SMOKE) {
                console.error('[MCP stderr]:', data.toString());
            }
        });
    }
    async sendRequest(method, params) {
        const id = this.requestId++;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(id, { resolve, reject });
            this.process.stdin.write(JSON.stringify(request) + '\n');
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error('Request timeout'));
                }
            }, 10000);
        });
    }
    async initialize() {
        await this.sendRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'beam-mcp-smoke-test',
                version: '1.0.0'
            }
        });
    }
    async listTools() {
        const result = await this.sendRequest('tools/list');
        return result.tools || [];
    }
    async callTool(name, arguments_) {
        const result = await this.sendRequest('tools/call', {
            name,
            arguments: arguments_
        });
        if (result && result.content && result.content[0] && result.content[0].text) {
            try {
                return JSON.parse(result.content[0].text);
            }
            catch (e) {
                console.error('Failed to parse MCP response:', result.content[0].text);
                throw new Error('Invalid JSON response from MCP server');
            }
        }
        return result;
    }
    close() {
        this.process.kill();
    }
}
async function main() {
    const args = process.argv.slice(2);
    let query = 'snowboard';
    let detailsProductId = null;
    let checkoutProductId = null;
    let variantId = null;
    let quantity = 1;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--details' && i + 1 < args.length) {
            detailsProductId = args[i + 1];
            i++;
        }
        else if (arg === '--checkout' && i + 1 < args.length) {
            checkoutProductId = args[i + 1];
            i++;
        }
        else if (arg === '--variant' && i + 1 < args.length) {
            variantId = args[i + 1];
            i++;
        }
        else if (arg === '--qty' && i + 1 < args.length) {
            quantity = parseInt(args[i + 1]) || 1;
            i++;
        }
        else if (!arg.startsWith('--')) {
            query = arg;
        }
    }
    console.log('🧪 Beam MCP Smoke Test');
    console.log('======================');
    const repoRoot = process.cwd();
    const mcpServerPath = path.join(repoRoot, 'dist', 'mcp', 'server.js');
    console.log(`🎯 Testing MCP server: ${mcpServerPath}`);
    console.log('');
    const client = new MCPClient(mcpServerPath);
    try {
        console.log('🔗 Initializing MCP connection...');
        await client.initialize();
        console.log('✅ MCP connection established');
        console.log('🛠️  Listing available tools...');
        const tools = await client.listTools();
        console.log(`✅ Found ${tools.length} tools:`, tools.map(t => t.name).join(', '));
        console.log('');
        if (detailsProductId) {
            console.log(`🔍 Getting details for product: ${detailsProductId}`);
            const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'beam-devtest.myshopify.com';
            const result = await client.callTool('get_product_details', {
                product_id: detailsProductId,
                shop_domain: shopDomain
            });
            console.log('📋 Product Details:');
            console.log(JSON.stringify(result, null, 2));
        }
        else if (checkoutProductId) {
            console.log(`🛒 Creating checkout link for product: ${checkoutProductId}`);
            const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'beam-devtest.myshopify.com';
            const checkoutArgs = {
                product_id: checkoutProductId,
                shop_domain: shopDomain,
                qty: quantity
            };
            if (variantId) {
                checkoutArgs.variant = variantId;
            }
            const result = await client.callTool('create_checkout_link', checkoutArgs);
            console.log('🔗 Checkout Link:');
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log(`🔍 Searching for products: "${query}"`);
            const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN || 'beam-devtest.myshopify.com';
            const result = await client.callTool('find_products', {
                shop_domain: shopDomain,
                query: query,
                limit: 5
            });
            console.log(`📦 Found ${result.length || 0} products:`);
            console.log('');
            if (result && result.length > 0) {
                result.forEach((product, index) => {
                    console.log(`${index + 1}. ${product.title}`);
                    console.log(`   ID: ${product.product_id}`);
                    console.log(`   Brand: ${product.brand || 'N/A'}`);
                    console.log(`   Price: ${product.currency || '$'}${product.price || 'N/A'}`);
                    console.log(`   Category: ${product.category || 'N/A'}`);
                    console.log('');
                });
                console.log('💡 Try these commands:');
                console.log(`   npm run mcp:smoke -- --details ${result[0].product_id}`);
                console.log(`   npm run mcp:smoke -- --checkout ${result[0].product_id}`);
            }
            else {
                console.log('   No products found.');
            }
        }
        console.log('');
        console.log('✅ Smoke test completed successfully!');
    }
    catch (error) {
        console.error('');
        console.error('❌ Smoke test failed:');
        console.error(`   ${error instanceof Error ? error.message : error}`);
        console.error('');
        console.error('🔧 Troubleshooting:');
        console.error('   1. Ensure "npm run build" has been run');
        console.error('   2. Check that your .env file contains correct Supabase credentials');
        console.error('   3. Verify the MCP server starts with "npm run mcp:dist"');
        console.error('   4. Try with DEBUG_MCP_SMOKE=1 for more details');
        process.exit(1);
    }
    finally {
        client.close();
    }
}
if (require.main === module) {
    main().catch(error => {
        console.error('💥 Unexpected error:', error);
        process.exit(1);
    });
}
