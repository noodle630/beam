#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
console.log('🔍 Environment Variables Debug');
console.log('===============================');
console.log('📂 Current working directory:', process.cwd());
console.log('🏗️  Node environment:', process.env.NODE_ENV);
console.log('🌐 Next runtime:', process.env.NEXT_RUNTIME);
console.log('');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
console.log('🔑 Supabase URL:', supabaseUrl ? '✅ Present (length: ' + supabaseUrl.length + ')' : '❌ Missing');
console.log('🗝️  Supabase Key:', supabaseKey ? '✅ Present (length: ' + supabaseKey.length + ')' : '❌ Missing');
console.log('🏪 Shop Domain:', shopDomain ? '✅ Present: ' + shopDomain : '❌ Missing');
console.log('');
if (supabaseUrl && supabaseKey) {
    console.log('✅ Environment variables loaded successfully');
}
else {
    console.log('❌ Missing required environment variables');
    console.log('');
    console.log('💡 Troubleshooting steps:');
    console.log('   1. Check that .env file exists in project root');
    console.log('   2. Ensure environment variables are set correctly');
    console.log('   3. Try running with explicit env vars:');
    console.log('      NEXT_PUBLIC_SUPABASE_URL=... npm run mcp:smoke');
}
